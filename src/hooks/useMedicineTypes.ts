import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  DEFAULT_MEDICINE_TYPES,
  getSavedMedicineTypes,
  mergeMedicineTypes,
  normalizeMedicineType,
  saveCustomMedicineTypes,
} from '../lib/medicineTypes';

type AddMedicineTypeResult = {
  ok: boolean;
  type?: string;
  reason?: 'empty' | 'exists' | 'error';
};

const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);

const isMissingMedicineTypesTable = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;

  const maybeError = error as { code?: string; message?: string };
  return (
    (typeof maybeError.code === 'string' && MISSING_TABLE_CODES.has(maybeError.code))
    || (typeof maybeError.message === 'string' && /medicine_types/i.test(maybeError.message))
  );
};

export function useMedicineTypes(extraTypes: string[] = []) {
  const [loading, setLoading] = useState(true);
  const [tableAvailable, setTableAvailable] = useState<boolean | null>(null);
  const [storedTypes, setStoredTypes] = useState<string[]>(() =>
    mergeMedicineTypes(DEFAULT_MEDICINE_TYPES, getSavedMedicineTypes())
  );

  const medicineTypes = useMemo(
    () => mergeMedicineTypes(storedTypes, extraTypes),
    [storedTypes, extraTypes]
  );

  useEffect(() => {
    saveCustomMedicineTypes(medicineTypes);
  }, [medicineTypes]);

  const refreshMedicineTypes = useCallback(async () => {
    setLoading(true);

    const localTypes = getSavedMedicineTypes();
    const { data, error } = await supabase
      .from('medicine_types')
      .select('type_name')
      .eq('is_active', true)
      .order('type_name');

    if (error) {
      if (isMissingMedicineTypesTable(error)) {
        setTableAvailable(false);
      }

      setStoredTypes(mergeMedicineTypes(DEFAULT_MEDICINE_TYPES, localTypes));
      setLoading(false);
      return;
    }

    setTableAvailable(true);
    const remoteTypes = (data || [])
      .map((row) => row.type_name)
      .filter((value): value is string => typeof value === 'string');

    setStoredTypes(mergeMedicineTypes(DEFAULT_MEDICINE_TYPES, localTypes, remoteTypes));
    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshMedicineTypes();
  }, [refreshMedicineTypes]);

  const addMedicineType = useCallback(async (
    rawType: string,
    createdBy?: string | null
  ): Promise<AddMedicineTypeResult> => {
    const type = normalizeMedicineType(rawType);
    if (!type) return { ok: false, reason: 'empty' };

    const exists = medicineTypes.some((item) => item.toLowerCase() === type.toLowerCase());
    if (exists) return { ok: false, reason: 'exists' };

    const shouldTryTable = tableAvailable !== false;
    if (shouldTryTable) {
      const { error } = await supabase
        .from('medicine_types')
        .insert({
          type_name: type,
          created_by: createdBy || null,
          is_active: true,
        });

      if (!error) {
        setTableAvailable(true);
        await refreshMedicineTypes();
        return { ok: true, type };
      }

      if (error.code === '23505') {
        await refreshMedicineTypes();
        return { ok: false, reason: 'exists' };
      }

      if (isMissingMedicineTypesTable(error)) {
        setTableAvailable(false);
      } else {
        return { ok: false, reason: 'error' };
      }
    }

    setStoredTypes((prev) => mergeMedicineTypes(prev, [type]));
    return { ok: true, type };
  }, [medicineTypes, refreshMedicineTypes, tableAvailable]);

  return {
    medicineTypes,
    loading,
    tableAvailable,
    refreshMedicineTypes,
    addMedicineType,
  };
}
