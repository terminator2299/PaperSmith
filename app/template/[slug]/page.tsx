import { Suspense } from 'react';
import DynamicPDFAnnotator from '@/components/DynamicPDFAnnotator';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PageProps {
    params: {
        slug: string;
    };
}

export default async function TemplatePage({ params }: PageProps) {
    const { slug } = params;
    const template_id = slug;

    // Retrieve file_id from Supabase
    const { data, error } = await supabase
        .from('templates')
        .select('file_id')
        .eq('id', template_id)
        .single();

    if (error) {
        console.error('Error fetching template:', error);
        return <div>Error loading template</div>;
    }

    if (!data || !data.file_id) {
        return <div>Template not found</div>;
    }

    const file_id = data.file_id;
    const pdfUrl = `${process.env.SUPABASE_TEMPLATE_STORAGE}${file_id}`;

    return (
        <div className="container mx-auto p-4 h-screen">
            <Suspense fallback={<div>Loading PDF...</div>}>
                <DynamicPDFAnnotator pdfUrl={pdfUrl} templateId={template_id} />
            </Suspense>
        </div>
    );
}
