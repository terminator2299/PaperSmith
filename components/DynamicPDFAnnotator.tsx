import dynamic from 'next/dynamic';
import { ComponentProps } from 'react';

const PDFAnnotator = dynamic(() => import('./PDFAnnotator'), {
    ssr: false,
});

const DynamicPDFAnnotator: React.FC<ComponentProps<typeof PDFAnnotator>> = (props) => {
    return <PDFAnnotator {...props} />;
};

export default DynamicPDFAnnotator;
