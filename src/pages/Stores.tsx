// Stores page
import { MapPin, Clock, ExternalLink } from 'lucide-react';
import { STORES } from '@/lib/dummy-data';
import { cn } from '@/lib/utils';

export function Stores() {
  return (
    <main className="min-h-screen bg-white pt-16">
      {/* Header */}
      <div className="bg-[#F5F5F7] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-[#111111] mb-4">
            Nuestras Tiendas
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Visítanos en cualquiera de nuestras sucursales. Nuestro equipo está listo para ayudarte a encontrar el uniforme perfecto.
          </p>
        </div>
      </div>

      {/* Stores Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {STORES.map((store) => (
            <div
              key={store.id}
              className={cn(
                'border rounded-xl p-6 transition-all duration-300 hover:shadow-lg',
                store.isMain
                  ? 'border-[#111111] bg-[#F5F5F7]'
                  : 'border-[#E5E5E5] bg-white hover:border-[#111111]'
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  {store.isMain && (
                    <span className="inline-block px-2 py-1 bg-[#111111] text-white text-xs font-medium rounded mb-2">
                      MATRIZ
                    </span>
                  )}
                  <h2 className="text-xl font-bold text-[#111111]">{store.name}</h2>
                </div>
                <div className="p-2 bg-[#F5F5F7] rounded-full">
                  <MapPin className="w-5 h-5 text-[#111111]" strokeWidth={1.5} />
                </div>
              </div>

              {/* Address */}
              <div className="mb-4">
                <p className="text-sm text-gray-500 flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                  {store.address}
                </p>
              </div>

              {/* Hours */}
              <div className="mb-6">
                <p className="text-sm text-gray-500 flex items-start gap-2">
                  <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                  {store.hours}
                </p>
              </div>

              {/* CTA */}
              <a
                href={store.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-colors',
                  store.isMain
                    ? 'bg-[#111111] text-white hover:opacity-80'
                    : 'border border-[#111111] text-[#111111] hover:bg-[#111111] hover:text-white'
                )}
              >
                <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                Ver en Google Maps
              </a>
            </div>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="mt-16 text-center">
          <p className="text-gray-500 mb-4">
            ¿Tienes alguna pregunta? Contáctanos directamente
          </p>
          <a
            href="https://wa.me/593999999999"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white font-medium rounded-full hover:opacity-90 transition-opacity"
          >
            Escribir por WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
}
