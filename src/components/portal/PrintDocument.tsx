import { Invoice, Prescription } from '../../lib/types';
import { formatPKR } from '../../lib/format';
import { format } from 'date-fns';

const STATUS_LABELS: Record<string, string> = {
  unpaid: 'UNPAID', paid: 'PAID', partial: 'PARTIAL', cancelled: 'CANCELLED',
};

interface Props {
  invoice?: Invoice | null;
  prescription?: Prescription | null;
  clinicName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
}

export default function PrintDocument({ invoice, prescription, clinicName, clinicAddress, clinicPhone }: Props) {
  const patientName = (invoice?.patient as unknown as { name?: string })?.name
    || (prescription?.patient as unknown as { name?: string })?.name
    || '—';

  const doctorName = (invoice?.doctor as unknown as { name?: string })?.name
    || (prescription?.doctor as unknown as { name?: string })?.name
    || '—';

  const clinic = clinicName || (invoice?.clinic as unknown as { clinic_name?: string })?.clinic_name || 'PearlSmile Dental';
  const address = clinicAddress || (invoice?.clinic as unknown as { address?: string })?.address || '';
  const phone = clinicPhone || (invoice?.clinic as unknown as { phone?: string })?.phone || '';

  const rxStatus = prescription ? (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (!prescription.start_date && !prescription.end_date) return null;
    const start = prescription.start_date ? new Date(prescription.start_date) : null;
    const end = prescription.end_date ? new Date(prescription.end_date) : null;
    if (end && end < today) return 'Expired';
    if (start && start > today) return 'Upcoming';
    return 'Active';
  })() : null;

  return (
    <div className="print-doc font-sans text-gray-900 text-sm leading-relaxed" style={{ minWidth: 480 }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5 pb-4 border-b-2 border-gray-900">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">{clinic}</h1>
          {address && <p className="text-xs text-gray-600 mt-0.5">{address}</p>}
          {phone && <p className="text-xs text-gray-600">{phone}</p>}
        </div>
        <div className="text-right">
          {invoice && (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Invoice</p>
              <p className="text-lg font-bold">#{invoice.id.slice(0, 8).toUpperCase()}</p>
              <p className="text-xs text-gray-500">{format(new Date(invoice.created_at), 'MMMM d, yyyy')}</p>
            </>
          )}
          {prescription && !invoice && (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Prescription</p>
              <p className="text-lg font-bold">#{prescription.id.slice(0, 8).toUpperCase()}</p>
              <p className="text-xs text-gray-500">{format(new Date(prescription.created_at), 'MMMM d, yyyy')}</p>
            </>
          )}
          {invoice && prescription && (
            <p className="text-xs text-gray-400 mt-1">Rx #{prescription.id.slice(0, 6).toUpperCase()}</p>
          )}
        </div>
      </div>

      {/* Patient & Doctor Info */}
      <div className="grid grid-cols-3 gap-4 mb-5 bg-gray-50 rounded-xl p-4">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Patient</p>
          <p className="font-bold">{patientName}</p>
          {(invoice?.patient as unknown as { contact?: string })?.contact && (
            <p className="text-xs text-gray-500">{(invoice.patient as unknown as { contact: string }).contact}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Doctor</p>
          <p className="font-semibold">Dr. {doctorName}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Date</p>
          <p className="font-semibold">
            {invoice
              ? format(new Date(invoice.created_at), 'MMM d, yyyy')
              : prescription
                ? format(new Date(prescription.created_at), 'MMM d, yyyy')
                : '—'}
          </p>
        </div>
      </div>

      {/* Invoice Items */}
      {invoice && invoice.items?.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Services / Treatments</p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2 font-semibold text-gray-700">Description</th>
                <th className="text-center py-2 font-semibold text-gray-700 w-12">Qty</th>
                <th className="text-right py-2 font-semibold text-gray-700 w-24">Unit</th>
                <th className="text-right py-2 font-semibold text-gray-700 w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2">{item.description}</td>
                  <td className="py-2 text-center">{item.quantity}</td>
                  <td className="py-2 text-right">{formatPKR(item.unit_price)}</td>
                  <td className="py-2 text-right font-medium">{formatPKR(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 ml-auto w-60 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatPKR(invoice.total_amount - invoice.doctor_fee)}</span>
            </div>
            {invoice.doctor_fee > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Doctor Fee</span>
                <span>{formatPKR(invoice.doctor_fee)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t-2 border-gray-900 pt-1.5">
              <span>Total</span>
              <span>{formatPKR(invoice.total_amount)}</span>
            </div>
            {(invoice.status === 'partial' || invoice.status === 'paid') && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Paid</span>
                <span>{formatPKR(invoice.amount_paid)}</span>
              </div>
            )}
            {invoice.status === 'partial' && (
              <div className="flex justify-between text-amber-700 font-semibold">
                <span>Balance Due</span>
                <span>{formatPKR(Math.max(0, invoice.total_amount - invoice.amount_paid))}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1">
              <span className="text-gray-500 text-xs">Payment Status</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                invoice.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                invoice.status === 'unpaid' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {STATUS_LABELS[invoice.status] || invoice.status}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Divider between invoice and prescription */}
      {invoice && prescription && (
        <div className="border-t-2 border-dashed border-gray-300 my-5 flex items-center justify-center">
          <span className="bg-white px-3 text-xs text-gray-400 font-semibold uppercase tracking-widest -mt-2.5">Prescription</span>
        </div>
      )}

      {/* Prescription */}
      {prescription && (
        <div className="mb-4">
          {!invoice && (
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Prescription</p>
          )}

          {(prescription.start_date || prescription.end_date) && (
            <div className="flex items-center gap-4 mb-3 text-xs text-gray-600">
              <span>
                <span className="font-semibold">Period:</span>{' '}
                {prescription.start_date ? format(new Date(prescription.start_date), 'MMM d, yyyy') : '?'}
                {' → '}
                {prescription.end_date ? format(new Date(prescription.end_date), 'MMM d, yyyy') : 'Ongoing'}
              </span>
              {rxStatus && (
                <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${
                  rxStatus === 'Active' ? 'bg-emerald-100 text-emerald-700' :
                  rxStatus === 'Upcoming' ? 'bg-sky-100 text-sky-700' :
                  'bg-red-100 text-red-600'
                }`}>{rxStatus}</span>
              )}
            </div>
          )}

          {prescription.treatments && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Treatments Performed</p>
              <p className="text-sm whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2">{prescription.treatments}</p>
            </div>
          )}

          {prescription.medicines?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Medications</p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-1.5 font-semibold text-gray-700">Medicine</th>
                    <th className="text-left py-1.5 font-semibold text-gray-700">Type / Strength</th>
                    <th className="text-left py-1.5 font-semibold text-gray-700">Dose</th>
                    <th className="text-left py-1.5 font-semibold text-gray-700">Frequency</th>
                    <th className="text-left py-1.5 font-semibold text-gray-700">Duration</th>
                    <th className="text-left py-1.5 font-semibold text-gray-700">Instructions</th>
                  </tr>
                </thead>
                <tbody>
                  {prescription.medicines.map((med, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1.5 font-semibold">{med.medicine_name}</td>
                      <td className="py-1.5 text-gray-600">{[med.medicine_type, med.strength].filter(Boolean).join(' / ') || '—'}</td>
                      <td className="py-1.5 text-gray-700">{med.dose_quantity || '—'}</td>
                      <td className="py-1.5 text-gray-700">{med.frequency || '—'}</td>
                      <td className="py-1.5 text-gray-700">{med.duration || '—'}</td>
                      <td className="py-1.5 text-gray-600 italic">{med.special_instructions || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {prescription.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-gray-700 italic bg-gray-50 rounded-lg px-3 py-2">{prescription.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-200 flex justify-between text-xs text-gray-400">
        <span>Generated on {format(new Date(), 'MMM d, yyyy HH:mm')}</span>
        <span>{clinic}</span>
      </div>
    </div>
  );
}
