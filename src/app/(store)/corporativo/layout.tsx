import { CorporateCartProvider } from '@/context/CorporateCartContext';
import { CorporateCartButton } from '@/components/corporate/CorporateCartButton';

export default function CorporativoLayout({ children }: { children: React.ReactNode }) {
  return (
    <CorporateCartProvider>
      {children}
      <CorporateCartButton />
    </CorporateCartProvider>
  );
}
