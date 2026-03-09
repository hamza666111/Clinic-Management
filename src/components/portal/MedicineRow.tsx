import { X, ChevronDown } from 'lucide-react';
import { PrescriptionMedicine, Medicine, MedicineType } from '../../lib/types';

export const MEDICINE_TYPES: MedicineType[] = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Suspension',
  'Mouthwash',
  'Gel',
  'Cream',
  'Drops',
  'Injection',
  'Powder',
  'Spray',
  'Ointment',
  'Other',
];

export const DOSE_QUANTITY_PRESETS: Record<string, string[]> = {
  Tablet: ['1 tablet', '2 tablets', 'Half tablet'],
  Capsule: ['1 capsule', '2 capsules'],
  Syrup: ['2.5 ml', '5 ml', '7.5 ml', '10 ml', '15 ml', '20 ml'],
  Suspension: ['2.5 ml', '5 ml', '7.5 ml', '10 ml', '15 ml', '20 ml'],
  Mouthwash: ['10 ml rinse', '15 ml rinse'],
  Gel: ['Thin layer', 'Apply as directed'],
  Cream: ['Thin layer', 'Apply as directed'],
  Drops: ['1-2 drops', '2-3 drops'],
  Injection: ['1 vial', '0.5 ml', '1 ml', '2 ml'],
  Powder: ['1 sachet', '1 scoop'],
  Spray: ['1-2 sprays', '2-3 sprays'],
  Ointment: ['Thin layer', 'Apply as directed'],
  Other: ['As directed'],
};

const DEFAULT_DOSE_QUANTITIES = [
  '1 tablet', '2 tablets', 'Half tablet', '1 capsule',
  '5 ml', '10 ml', '15 ml', '10 ml rinse', '15 ml rinse',
];

export const FREQUENCY_PRESETS = [
  'Once daily (OD)',
  'Twice daily (BD)',
  'Three times daily (TDS)',
  'Four times daily (QID)',
  'Every 6 hours',
  'Every 8 hours',
  'Every 12 hours',
  'As needed (PRN)',
  'Morning only',
  'Night only',
  'Before sleep',
];

export const DURATION_PRESETS = [
  '3 days',
  '5 days',
  '7 days',
  '10 days',
  '14 days',
  'Until finished',
  'Custom duration',
];

export const SPECIAL_INSTRUCTION_PRESETS = [
  'After food',
  'Before food',
  'With food',
  'Shake well before use',
  'Rinse and spit',
  'Do not swallow',
  'Before sleep',
];

interface Props {
  index: number;
  med: PrescriptionMedicine;
  medicines: Medicine[];
  showRemove: boolean;
  onChange: (field: keyof PrescriptionMedicine, value: string) => void;
  onRemove: () => void;
  onSelectMedicine: (medicine: Medicine) => void;
}

function SelectField({
  value,
  options,
  placeholder,
  onChange,
  allowCustom = false,
  customValue,
  onCustomChange,
}: {
  value: string;
  options: string[];
  placeholder: string;
  onChange: (v: string) => void;
  allowCustom?: boolean;
  customValue?: string;
  onCustomChange?: (v: string) => void;
}) {
  const isCustom = allowCustom && value === '__custom__';

  return (
    <div className="relative">
      <select
        value={isCustom ? '__custom__' : value}
        onChange={e => {
          if (e.target.value === '__custom__') {
            onChange('__custom__');
          } else {
            onChange(e.target.value);
          }
        }}
        className="w-full appearance-none px-3 py-2 pr-8 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white text-gray-800"
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
        {allowCustom && <option value="__custom__">Custom...</option>}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
      {isCustom && allowCustom && (
        <input
          type="text"
          value={customValue || ''}
          onChange={e => onCustomChange?.(e.target.value)}
          placeholder="Enter custom..."
          autoFocus
          className="mt-1.5 w-full px-3 py-2 border border-sky-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
        />
      )}
    </div>
  );
}

export default function MedicineRow({
  index,
  med,
  medicines,
  showRemove,
  onChange,
  onRemove,
  onSelectMedicine
}: Props) {
  const doseOptions = med.medicine_type
    ? (DOSE_QUANTITY_PRESETS[med.medicine_type as keyof typeof DOSE_QUANTITY_PRESETS] || DEFAULT_DOSE_QUANTITIES)
    : DEFAULT_DOSE_QUANTITIES;

  const isDurationCustom = med.duration === '__custom__';
  const isInstructionCustom = med.special_instructions === '__custom__';

  const handleMedicineSelect = (selectedName: string) => {
    const medicine = medicines.find(m =>
      `${m.medicine_name} (${m.strength}) - ${m.medicine_type}` === selectedName
    );

    if (medicine) {
      onSelectMedicine(medicine);
    } else {
      onChange('medicine_name', selectedName);
    }
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Medicine {index + 1}</span>
        {showRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Medicine Name *</label>
          <div className="relative">
            <input
              value={med.medicine_name}
              onChange={e => onChange('medicine_name', e.target.value)}
              list={`med-list-${index}`}
              placeholder="Type or select medicine..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
            />
            <datalist id={`med-list-${index}`}>
              {medicines.map(m => (
                <option
                  key={m.id}
                  value={`${m.medicine_name} (${m.strength}) - ${m.medicine_type}`}
                />
              ))}
            </datalist>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Select from list or type new medicine name to add to master list
          </p>
        </div>

        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Medicine Type *</label>
          <div className="relative">
            <select
              value={med.medicine_type}
              onChange={e => {
                onChange('medicine_type', e.target.value);
                onChange('dose_quantity', '');
              }}
              className="w-full appearance-none px-3 py-2 pr-8 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
            >
              <option value="">Select type...</option>
              {MEDICINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Strength</label>
          <input
            value={med.strength}
            onChange={e => onChange('strength', e.target.value)}
            placeholder="e.g. 250mg, 500mg, 5ml"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Dose Quantity</label>
          <SelectField
            value={med.dose_quantity}
            options={doseOptions}
            placeholder="Select quantity..."
            onChange={v => onChange('dose_quantity', v)}
            allowCustom
            customValue={med.dose_quantity === '__custom__' ? '' : med.dose_quantity}
            onCustomChange={v => onChange('dose_quantity', v)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
          <SelectField
            value={med.frequency}
            options={FREQUENCY_PRESETS}
            placeholder="Select frequency..."
            onChange={v => onChange('frequency', v)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
          <SelectField
            value={isDurationCustom ? '__custom__' : med.duration}
            options={DURATION_PRESETS.filter(d => d !== 'Custom duration')}
            placeholder="Select duration..."
            onChange={v => onChange('duration', v === 'Custom duration' ? '__custom__' : v)}
            allowCustom
            customValue={isDurationCustom ? '' : ''}
            onCustomChange={v => onChange('duration', v)}
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Special Instructions</label>
          <SelectField
            value={isInstructionCustom ? '__custom__' : med.special_instructions}
            options={SPECIAL_INSTRUCTION_PRESETS}
            placeholder="Select instruction..."
            onChange={v => onChange('special_instructions', v)}
            allowCustom
            customValue={isInstructionCustom ? '' : ''}
            onCustomChange={v => onChange('special_instructions', v)}
          />
        </div>
      </div>

      {(med.medicine_name || med.medicine_type) && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {med.medicine_type && (
            <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-medium">{med.medicine_type}</span>
          )}
          {med.strength && (
            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-medium">{med.strength}</span>
          )}
          {med.dose_quantity && med.dose_quantity !== '__custom__' && (
            <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">{med.dose_quantity}</span>
          )}
          {med.frequency && med.frequency !== '__custom__' && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{med.frequency}</span>
          )}
          {med.duration && med.duration !== '__custom__' && (
            <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-medium">{med.duration}</span>
          )}
          {med.special_instructions && med.special_instructions !== '__custom__' && (
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{med.special_instructions}</span>
          )}
        </div>
      )}
    </div>
  );
}
