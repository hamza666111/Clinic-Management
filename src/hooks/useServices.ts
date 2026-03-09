import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DentalService, ClinicServicePrice } from '../lib/types';

const serviceNameCollator = new Intl.Collator(undefined, {
  sensitivity: 'base',
  numeric: true,
});

export interface ServiceWithEffectivePrice extends DentalService {
  effective_price: number;
}

export function useServices(clinicId?: string | null) {
  const [services, setServices] = useState<DentalService[]>([]);
  const [clinicPrices, setClinicPrices] = useState<ClinicServicePrice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('dental_services')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('sort_order')
      .then(({ data }) => {
        setServices((data || []) as DentalService[]);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!clinicId) { setClinicPrices([]); return; }
    supabase
      .from('clinic_service_prices')
      .select('*')
      .eq('clinic_id', clinicId)
      .then(({ data }) => setClinicPrices((data || []) as ClinicServicePrice[]));
  }, [clinicId]);

  const servicesWithPrice: ServiceWithEffectivePrice[] = services.map(s => {
    const override = clinicPrices.find(p => p.service_id === s.id);
    return { ...s, effective_price: override ? override.price : s.default_price };
  });

  const serviceNames = [...services.map(s => s.service_name)].sort(serviceNameCollator.compare);

  const byCategory = servicesWithPrice.reduce<Record<string, ServiceWithEffectivePrice[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  const findByName = (name: string) =>
    servicesWithPrice.find(s => s.service_name.toLowerCase() === name.toLowerCase());

  return { services: servicesWithPrice, serviceNames, byCategory, loading, findByName, clinicPrices };
}
