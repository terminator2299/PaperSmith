'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Signatory {
    name: string;
    email: string;
    phone: string;
}

interface PageProps {
    params: {
        slug: string;
    };
}

export default function SignatoriesPage({ params }: PageProps) {
    const [signatories, setSignatories] = useState<Signatory[]>([{ name: '', email: '', phone: '' }]);
    const [alert, setAlert] = useState({ show: false, message: '', isError: false });
    const [isLoading, setIsLoading] = useState(false);

    const router = useRouter();
    const { slug } = params;
    const template_id = slug;

    const handleInputChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        const newSignatories = [...signatories];
        newSignatories[index] = { ...newSignatories[index], [name]: value };
        setSignatories(newSignatories);
    };

    const addSignatory = () => {
        setSignatories([...signatories, { name: '', email: '', phone: '' }]);
    };

    const removeSignatory = (index: number) => {
        const newSignatories = signatories.filter((_, i) => i !== index);
        setSignatories(newSignatories);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsLoading(true);
        setAlert({ show: false, message: '', isError: false });

        if (signatories.length === 0) {
            setAlert({ show: true, message: 'Please add at least one signatory.', isError: true });
            setIsLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('signatories')
                .insert(signatories.map(signatory => ({
                    ...signatory,
                    template_id: template_id
                })));

            if (error) throw error;

            setAlert({ show: true, message: 'Signatories added successfully!', isError: false });
            setSignatories([{ name: '', email: '', phone: '' }]);
            
            // Redirect to the template page
            router.push(`/template/${template_id}`);
        } catch (error) {
            console.log('Error adding signatories:', error);
            setAlert({ show: true, message: 'An error occurred while adding signatories.', isError: true });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Add Signatories</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
                {signatories.map((signatory, index) => (
                    <div key={index} className="border p-4 rounded-md">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <Label htmlFor={`name-${index}`}>Name</Label>
                                <Input
                                    id={`name-${index}`}
                                    name="name"
                                    value={signatory.name}
                                    onChange={(e) => handleInputChange(index, e)}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor={`email-${index}`}>Email</Label>
                                <Input
                                    id={`email-${index}`}
                                    name="email"
                                    type="email"
                                    value={signatory.email}
                                    onChange={(e) => handleInputChange(index, e)}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor={`phone-${index}`}>Phone</Label>
                                <Input
                                    id={`phone-${index}`}
                                    name="phone"
                                    type="tel"
                                    value={signatory.phone}
                                    onChange={(e) => handleInputChange(index, e)}
                                    required
                                />
                            </div>
                        </div>
                        {index > 0 && (
                            <Button type="button" onClick={() => removeSignatory(index)} className="mt-2" variant="destructive">
                                Remove
                            </Button>
                        )}
                    </div>
                ))}
                <Button type="button" onClick={addSignatory} className="mr-2">
                    Add Another Signatory
                </Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Saving...' : 'Save Signatories'}
                </Button>
            </form>
        </div>
    );
};
