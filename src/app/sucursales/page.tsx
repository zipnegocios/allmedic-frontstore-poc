import { Stores } from '@/legacy-pages/Stores';
import { Footer } from '@/components/layout/Footer';
import { getStores } from '@/lib/data-service';

export default async function SucursalesPage() {
  const stores = await getStores();

  return (
    <>
      <Stores stores={stores} />
      <Footer stores={stores} />
    </>
  );
}
