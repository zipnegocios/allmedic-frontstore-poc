import { Footer } from '@/components/layout/Footer';

export default function CorporativoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Footer />
    </>
  );
}
