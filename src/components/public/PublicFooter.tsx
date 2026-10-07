import React from "react";
import { Link } from "react-router-dom";
import { useCms } from "../../context/CmsContext";
import {
  Church,
  MapPin,
  Phone,
  Mail,
  Clock,
  ExternalLink,
  Shield,
  LayoutDashboard,
} from "lucide-react";

export const PublicFooter: React.FC = () => {
  const { settings } = useCms();
  // A field the congregation has not filled in is left out, and a column with nothing in it is not drawn
  const hasContact = Boolean(settings.address || settings.phone || settings.email || settings.officeHours);
  const hasGiving = Boolean(settings.vippsNumber || settings.bankAccount);

  return (
    <footer className="bg-stone-900 text-stone-300 border-t border-stone-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Col 1: Brand & Church info */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center text-white">
                <Church className="w-5 h-5 text-accent-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {settings.churchName}
                </h3>
                <p className="text-xs text-stone-400">{settings.appName} Plattform</p>
              </div>
            </div>
            {settings.tagline && <p className="text-xs text-stone-400 leading-relaxed">{settings.tagline}</p>}
            {settings.orgNumber && (
              <div className="pt-2 text-xs text-stone-400">
                <span className="font-semibold text-stone-200">Orgnr:</span> {settings.orgNumber}
              </div>
            )}
          </div>

          {/* Col 2: Besøk & Kontakt */}
          {hasContact && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Besøk & Kontakt
              </h4>
              <ul className="space-y-2.5 text-xs text-stone-300">
                {settings.address && (
                  <li className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-accent-400 shrink-0 mt-0.5" />
                    <span>{settings.address}</span>
                  </li>
                )}
                {settings.phone && (
                  <li className="flex items-center gap-2.5">
                    <Phone className="w-4 h-4 text-accent-400 shrink-0" />
                    <a href={`tel:${settings.phone}`} className="hover:text-white transition-colors">
                      {settings.phone}
                    </a>
                  </li>
                )}
                {settings.email && (
                  <li className="flex items-center gap-2.5">
                    <Mail className="w-4 h-4 text-accent-400 shrink-0" />
                    <a href={`mailto:${settings.email}`} className="hover:text-white transition-colors">
                      {settings.email}
                    </a>
                  </li>
                )}
                {settings.officeHours && (
                  <li className="flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-accent-400 shrink-0 mt-0.5" />
                    <span>{settings.officeHours}</span>
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Col 3: Gaver & Støtte */}
          {hasGiving && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Gaver & Kollekt
              </h4>
              <div className="p-3.5 rounded-xl bg-stone-800/80 border border-stone-700/60 space-y-2">
                {settings.vippsNumber && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-stone-200">Vipps</span>
                      <span className="text-xs font-black text-accent-300 px-2 py-0.5 bg-accent-400/10 rounded">
                        {settings.vippsNumber}
                      </span>
                    </div>
                    {settings.vippsDescription && <p className="text-[11px] text-stone-400">{settings.vippsDescription}</p>}
                  </>
                )}
                {settings.bankAccount && (
                  <div className={settings.vippsNumber ? "pt-2 border-t border-stone-700/60" : undefined}>
                    <div className="text-[11px] text-stone-400">Bankkonto:</div>
                    <div className="text-xs font-mono font-bold text-stone-200">{settings.bankAccount}</div>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-stone-400">
                Gaver over kr 500 gir rett til skattefradrag.
              </p>
            </div>
          )}

          {/* Col 4: Snarveier & Min Side */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Menighet & Tjeneste
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/minside" className="text-stone-300 hover:text-white flex items-center gap-1.5 transition-colors">
                  <LayoutDashboard className="w-3.5 h-3.5 text-accent-400" />
                  <span>Min Side (For frivillige og ledere)</span>
                </Link>
              </li>
              <li>
                <Link to="/hva-skjer" className="text-stone-300 hover:text-white transition-colors">
                  Gudstjenester & Kalender
                </Link>
              </li>
              <li>
                <Link to="/taler" className="text-stone-300 hover:text-white transition-colors">
                  Taler & Prekener
                </Link>
              </li>
              <li>
                <Link to="/fellesskap" className="text-stone-300 hover:text-white transition-colors">
                  Husfellesskap & Grupper
                </Link>
              </li>
              <li>
                <Link to="/lederskap" className="text-stone-300 hover:text-white transition-colors">
                  Stab & Lederskap
                </Link>
              </li>
              <li>
                <Link to="/om-oss" className="text-stone-300 hover:text-white transition-colors">
                  Om menigheten og våre verdier
                </Link>
              </li>
              <li>
                <Link to="/admin" className="text-primary-400 hover:text-primary-300 flex items-center gap-1.5 font-semibold transition-colors">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin & CMS Studio</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright line */}
        <div className="mt-12 pt-8 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-4">
          <p>© {new Date().getFullYear()} {settings.churchName}. Alle rettigheter reservert.</p>
          <div className="flex items-center gap-4">
            <Link to="/kontakt" className="hover:text-stone-300">Kontakt</Link>
            <span>·</span>
            <Link to="/minside" className="hover:text-stone-300">Min Side</Link>
            <span>·</span>
            <a
              href="/api/offentlig/arrangementer"
              target="_blank"
              rel="noreferrer"
              className="hover:text-stone-300 flex items-center gap-1"
            >
              <span>Åpent API</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
