export const DEFAULT_MEDICINE_TYPES = [
  'Capsule',
  'Cream',
  'Drops',
  'Gel',
  'Injection',
  'Mouthwash',
  'Ointment',
  'Other',
  'Powder',
  'Spray',
  'Suspension',
  'Syrup',
  'Tablet',
];

export const MEDICINE_TYPES_STORAGE_KEY = 'clinic_management:medicine_types';

const collator = new Intl.Collator(undefined, {
  sensitivity: 'base',
  numeric: true,
});

export const sortAlphabetically = (values: string[]) => [...values].sort(collator.compare);

export const normalizeMedicineType = (value: string) => value.trim().replace(/\s+/g, ' ');

export const mergeMedicineTypes = (...typeLists: string[][]) => {
  const seen = new Set<string>();
  const merged: string[] = [];

  typeLists.forEach((list) => {
    list.forEach((rawType) => {
      const type = normalizeMedicineType(rawType);
      if (!type) return;

      const key = type.toLowerCase();
      if (seen.has(key)) return;

      seen.add(key);
      merged.push(type);
    });
  });

  return sortAlphabetically(merged);
};

export const getSavedMedicineTypes = () => {
  if (typeof window === 'undefined') return [] as string[];

  try {
    const raw = window.localStorage.getItem(MEDICINE_TYPES_STORAGE_KEY) || '[]';
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [] as string[];

    return mergeMedicineTypes(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return [] as string[];
  }
};

export const saveCustomMedicineTypes = (allTypes: string[]) => {
  if (typeof window === 'undefined') return;

  const customTypes = allTypes.filter(
    (type) => !DEFAULT_MEDICINE_TYPES.some((defaultType) => defaultType.toLowerCase() === type.toLowerCase())
  );

  window.localStorage.setItem(
    MEDICINE_TYPES_STORAGE_KEY,
    JSON.stringify(sortAlphabetically(customTypes))
  );
};
