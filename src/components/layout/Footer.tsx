import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, MapPin, Instagram, Facebook } from 'lucide-react';
import { STORES } from '@/lib/dummy-data';
import { cn } from '@/lib/utils';

export function Footer() {
  const [expandedStore, setExpandedStore] = useState<string | null>(null);

  return (
    <footer className="bg-[#111111] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {/* Brand Column */}
          <div>
            <Link to="/" className="inline-block">
              <img
                src="/images/allmedic_logo_white.png"
                alt="AllMedic Uniforms"
                className="h-10 w-auto"
              />
            </Link>
            <p className="mt-4 text-sm text-gray-400 leading-relaxed max-w-xs">
              Uniformes médicos de alta gama para profesionales que exigen lo mejor. 
              Representantes oficiales de las mejores marcas en Ecuador.
            </p>
            <div className="flex items-center gap-4 mt-6">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
              >
                <Instagram className="w-5 h-5" strokeWidth={1.5} />
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
              >
                <Facebook className="w-5 h-5" strokeWidth={1.5} />
              </a>
            </div>
          </div>

          {/* Links Column */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-widest mb-4">
              Enlaces rápidos
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/catalogo"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Catálogo
                </Link>
              </li>
              <li>
                <Link
                  to="/marcas"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Marcas
                </Link>
              </li>
              <li>
                <Link
                  to="/sucursales"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Sucursales
                </Link>
              </li>
              <li>
                <a
                  href="https://wa.me/593999999999"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Contacto
                </a>
              </li>
            </ul>
          </div>

          {/* Stores Column */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-widest mb-4">
              Nuestras tiendas
            </h3>
            <div className="space-y-2">
              {STORES.map(store => (
                <div
                  key={store.id}
                  className="border border-white/10 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedStore(expandedStore === store.id ? null : store.id)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
                      <span className="text-sm font-medium">{store.name}</span>
                    </div>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-gray-400 transition-transform',
                        expandedStore === store.id && 'rotate-180'
                      )}
                      strokeWidth={1.5}
                    />
                  </button>
                  {expandedStore === store.id && (
                    <div className="px-3 pb-3 pt-0 border-t border-white/10">
                      <p className="text-sm text-gray-400 mt-2">{store.address}</p>
                      <p className="text-sm text-gray-400 mt-1">{store.hours}</p>
                      <a
                        href={store.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-sm text-white hover:underline"
                      >
                        Ver en Google Maps
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} AllMedic Uniforms. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-xs text-gray-500 hover:text-white transition-colors">
                Términos y condiciones
              </a>
              <a href="#" className="text-xs text-gray-500 hover:text-white transition-colors">
                Política de privacidad
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
