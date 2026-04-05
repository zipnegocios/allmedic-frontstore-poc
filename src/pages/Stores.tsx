import { MapPin, Phone, Clock, Navigation } from 'lucide-react';
import { STORES } from '@/lib/dummy-data';
import { cn } from '@/lib/utils';

export function Stores() {
  return (
    <main className="min-h-screen bg-white pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-[#111111] mb-4">
            Nuestras Sucursales
          </h1>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Visítanos en cualquiera de nuestras sucursales. Nuestro equipo estará encantado de atenderte.
          </p>
        </div>

        {/* Stores Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {STORES.map((store) => (
            <div
              key={store.id}
              className={cn(
                'bg-white border rounded-xl p-6 transition-all hover:shadow-lg',
                store.isMain
                  ? 'border-[#111111] ring-1 ring-[#111111]'
                  : 'border-[#E5E5E5]'
              )}
            >
              {/* Badge */}
              {store.isMain && (
                <div className="inline-flex items-center gap-1 px-3 py-1 bg-[#111111] text-white text-xs font-bold rounded-full mb-4">
                  MATRIZ
                </div>
              )}

              {/* Name */}
              <h3 className="text-xl font-bold text-[#111111] mb-4">
                {store.name}
              </h3>

              {/* Info */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                  <p className="text-gray-600">{store.address}</p>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                  <p className="text-gray-600">{store.hours}</p>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                  <p className="text-gray-600">{store.phone}</p>
                </div>
              </div>

              {/* CTA */}
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(store.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors',
                  store.isMain
                    ? 'bg-[#111111] text-white hover:bg-[#333333]'
                    : 'bg-[#F5F5F7] text-[#111111] hover:bg-[#E5E5E5]'
                )}
              >
                <Navigation className="w-4 h-4" strokeWidth={1.5} />
                Cómo llegar
              </a>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
