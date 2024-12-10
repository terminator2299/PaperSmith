import { NextRequest, NextResponse } from 'next/server';
import { ServicePrincipalCredentials, PDFServices, MimeType, CreatePDFJob, CreatePDFResult, StreamAsset } from '@adobe/pdfservices-node-sdk';
import { createClient } from '@supabase/supabase-js';
import { Readable } from 'stream';
import * as crypto from 'crypto';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Create credentials instance.
const credentials = new ServicePrincipalCredentials({
    clientId: process.env.ADOBE_CLIENT_ID as string,
    clientSecret: process.env.ADOBE_CLIENT_SECRET as string
});

const pdfServices = new PDFServices({
    credentials
});

function getMimeType(fileExtension: string): MimeType {
    switch (fileExtension.toLowerCase()) {
        case 'doc':
            return MimeType.DOC;
        case 'docx':
            return MimeType.DOCX;
        case 'ppt':
            return MimeType.PPT;
        case 'pptx':
            return MimeType.PPTX;
        case 'xls':
            return MimeType.XLS;
        case 'xlsx':
            return MimeType.XLSX;
        case 'txt':
            return MimeType.TXT;
        case 'rtf':
            return MimeType.RTF;
        case 'html':
        case 'htm':
            return MimeType.HTML;
        default:
            throw new Error(`Unsupported file type: ${fileExtension}`);
    }
}

async function fileToStream(file: File): Promise<NodeJS.ReadableStream> {
    const readable = new Readable();
    const buffer = Buffer.from(await file.arrayBuffer());
    readable._read = () => { }; // _read is required but you can noop it
    readable.push(buffer);
    readable.push(null); // end the stream
    return readable;
}

async function streamAssetToBuffer(streamAsset: StreamAsset): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        streamAsset.readStream.on('data', (chunk: Buffer) => chunks.push(chunk));
        streamAsset.readStream.on('end', () => resolve(Buffer.concat(chunks)));
        streamAsset.readStream.on('error', reject);
    });
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const fileExtension = file.name.split('.').pop()?.toLowerCase() || "";
        const nameHash = crypto.createHash('sha256').update(`${Date.now()}-${file.name.replace(/\.[^/.]+$/, "")}.pdf`).digest('hex');
        const uniqueFileName = `${nameHash}.pdf`;

        let pdfFile: Buffer;

        if (fileExtension !== 'pdf') {
            // Convert to PDF using Adobe PDF Services API

            // Creates an asset(s) from source file(s) and upload
            const readStream = await fileToStream(file);
            const inputAsset = await pdfServices.upload({
                readStream,
                mimeType: getMimeType(fileExtension),
            });

            // Creates a new job instance
            const job = new CreatePDFJob({
                inputAsset
            });

            // Submit the job and get the job result
            const pollingURL = await pdfServices.submit({
                job
            });
            const pdfServicesResponse = await pdfServices.getJobResult({
                pollingURL,
                resultType: CreatePDFResult
            });

            // Get content from the resulting asset(s)
            const resultAsset = pdfServicesResponse?.result?.asset;
            if (!resultAsset) {
                throw new Error('Failed to get result asset');
            }

            const streamAsset = await pdfServices.getContent({
                asset: resultAsset
            });

            pdfFile = await streamAssetToBuffer(streamAsset);
        } else {
            pdfFile = Buffer.from(await file.arrayBuffer());
        }

        // Upload PDF to Supabase storage
        const { error: uploadError, data: uploadData } = await supabase.storage
            .from('templates')
            .upload(uniqueFileName, pdfFile, {
                contentType: 'application/pdf',
            });

        if (uploadError) {
            throw new Error('Error uploading to Supabase: ' + uploadError.message);
        }

        const file_id = uploadData.path;
        const { error: insertError, data: insertData } = await supabase
            .from('templates')
            .insert({ file_id: file_id })
            .select();

        if (insertError) {
            throw new Error('Error inserting into database: ' + insertError.message);
        }

        return NextResponse.json({
            message: 'File uploaded and saved successfully',
            filename: uniqueFileName,
            id: insertData[0].id,
            file_id: file_id
        });
    } catch (error) {
        console.error('Error processing file:', error);
        return NextResponse.json({ error: 'Error processing file' }, { status: 500 });
    }
}
