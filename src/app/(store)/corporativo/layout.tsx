import { CorporateCartProvider } from '@/context/CorporateCartContext';
import { CorporateCartButton } from '@/components/corporate/CorporateCartButton';
import { CorporateAccountLink } from '@/components/corporate/CorporateAccountLink';
import { Footer } from '@/components/layout/Footer';

export default function CorporativoLayout({ children }: { children: React.ReactNode }) {
  return (
    <CorporateCartProvider>
      {children}
      <CorporateAccountLink />
      <CorporateCartButton />
      <Footer />
    </CorporateCartProvider>
  );
}
