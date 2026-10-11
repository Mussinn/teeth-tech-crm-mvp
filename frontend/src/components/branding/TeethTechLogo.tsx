import Image from 'next/image';

type TeethTechLogoProps = {
    className?: string;
    onDarkBackground?: boolean;
    priority?: boolean;

};

export default function TeethTechLogo({
    className = '',
    onDarkBackground = false,
    priority = false,

}: TeethTechLogoProps) {
    return (
        <span
            className={`inline-flex ${className}`}
        >
            <Image
                src="/teethtech-logo-full-v3.svg"
                alt="TeethTech CRM"
                width={620}
                height={160}
                priority={priority}
                className={`h-auto w-full ${
                    onDarkBackground
                        ? ''
                        : '[filter:brightness(0)_saturate(100%)_invert(12%)_sepia(26%)_saturate(2471%)_hue-rotate(177deg)_brightness(89%)_contrast(96%)] dark:[filter:none]'
                }`}
            />
        </span>
    );
}
