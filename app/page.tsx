'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const router = useRouter();

  // automatically redirect if uploadSuccess is true
  useEffect(() => {
    if (uploadSuccess === true) {
      router.push(`/signatories/${uploadStatus}`);
    }
  }, [uploadSuccess, uploadStatus, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        setUploadStatus("Upload failed");
        setUploadSuccess(false);
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setUploadStatus(data.id);
      setUploadSuccess(true);
    } catch (error) {
      setUploadStatus('Error uploading file. Please try again.');
      setUploadSuccess(false);
      console.error('Error uploading file:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <form onSubmit={handleSubmit} className="w-full max-w-xs">
        <Input
          type="file"
          onChange={handleFileChange}
          accept=".pdf,.docx,.doc,.pptx,.ppt,.rtf,.txt"
          className="mb-4"
        />
        <Button type="submit" disabled={!file || uploading} className="w-full">
          {uploading ? 'Uploading...' : 'Upload'}
        </Button>
      </form>
      {(uploadSuccess == true) && <Link href={`/template/${uploadStatus}`}>Proceed</Link>}
    </main>
  );
}
