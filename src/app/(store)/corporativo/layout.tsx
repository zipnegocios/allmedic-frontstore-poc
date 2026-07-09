import { CorporateCartProvider } from '@/context/CorporateCartContext';
import { CorporateCartButton } from '@/components/corporate/CorporateCartButton';
import { CorporateAccountLink } from '@/components/corporate/CorporateAccountLink';

export default function CorporativoLayout({ children }: { children: React.ReactNode }) {
  return (
    <CorporateCartProvider>
      {children}
      <CorporateAccountLink />
      <CorporateCartButton />
    </CorporateCartProvider>
  );
}
