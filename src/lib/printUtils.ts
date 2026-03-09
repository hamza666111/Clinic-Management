export function printDocument(content: HTMLElement | null, title: string = 'Document'): void {
  if (!content) {
    console.error('Print content is null');
    return;
  }

  const htmlContent = content.innerHTML;
  if (!htmlContent || htmlContent.trim().length === 0) {
    console.error('Print content is empty');
    return;
  }

  const win = window.open('', '_blank');
  if (!win) {
    console.error('Failed to open print window');
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; padding: 32px; color: #111; font-size: 13px; line-height: 1.5; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 6px 8px; }
          .border-b-2 { border-bottom: 2px solid #111; }
          .border-b { border-bottom: 1px solid #e5e7eb; }
          .border-t { border-top: 1px solid #e5e7eb; }
          .border-t-2 { border-top: 2px solid #111; }
          .border-dashed { border-style: dashed; }
          .border-gray-200 { border-color: #e5e7eb; }
          .border-gray-300 { border-color: #d1d5db; }
          .grid { display: grid; }
          .grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
          .gap-4 { gap: 16px; }
          .bg-gray-50 { background: #f9fafb; border-radius: 8px; padding: 12px; }
          .bg-white { background: white; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .text-left { text-align: left; }
          .ml-auto { margin-left: auto; width: 240px; }
          .font-bold { font-weight: 700; }
          .font-semibold { font-weight: 600; }
          .font-extrabold { font-weight: 800; }
          .font-medium { font-weight: 500; }
          .text-xs { font-size: 11px; }
          .text-sm { font-size: 13px; }
          .text-base { font-size: 15px; }
          .text-lg { font-size: 18px; }
          .text-2xl { font-size: 22px; }
          .uppercase { text-transform: uppercase; }
          .tracking-widest { letter-spacing: 0.1em; }
          .tracking-wide { letter-spacing: 0.05em; }
          .tracking-tight { letter-spacing: -0.025em; }
          .italic { font-style: italic; }
          .mb-0\\.5 { margin-bottom: 2px; }
          .mt-0\\.5 { margin-top: 2px; }
          .mb-1 { margin-bottom: 4px; }
          .mt-1 { margin-top: 4px; }
          .mb-2 { margin-bottom: 8px; }
          .mt-2 { margin-top: 8px; }
          .mb-3 { margin-bottom: 12px; }
          .mt-3 { margin-top: 12px; }
          .mb-4 { margin-bottom: 16px; }
          .mt-4 { margin-top: 16px; }
          .mb-5 { margin-bottom: 20px; }
          .mt-5 { margin-top: 20px; }
          .mt-6 { margin-top: 24px; }
          .my-5 { margin-top: 20px; margin-bottom: 20px; }
          .pb-4 { padding-bottom: 16px; }
          .pt-1 { padding-top: 4px; }
          .pt-1\\.5 { padding-top: 6px; }
          .pt-2 { padding-top: 8px; }
          .pt-4 { padding-top: 16px; }
          .py-0\\.5 { padding-top: 2px; padding-bottom: 2px; }
          .py-1 { padding-top: 4px; padding-bottom: 4px; }
          .py-1\\.5 { padding-top: 6px; padding-bottom: 6px; }
          .py-2 { padding-top: 8px; padding-bottom: 8px; }
          .px-2 { padding-left: 8px; padding-right: 8px; }
          .px-2\\.5 { padding-left: 10px; padding-right: 10px; }
          .px-3 { padding-left: 12px; padding-right: 12px; }
          .rounded-xl { border-radius: 12px; }
          .rounded-lg { border-radius: 8px; }
          .rounded-full { border-radius: 9999px; }
          .whitespace-pre-wrap { white-space: pre-wrap; }
          .space-y-1\\.5 > * + * { margin-top: 6px; }
          .flex { display: flex; }
          .items-start { align-items: flex-start; }
          .items-center { align-items: center; }
          .justify-between { justify-content: space-between; }
          .justify-center { justify-content: center; }
          .gap-3 { gap: 12px; }
          .gap-4 { gap: 16px; }
          .text-gray-400 { color: #9ca3af; }
          .text-gray-500 { color: #6b7280; }
          .text-gray-600 { color: #4b5563; }
          .text-gray-700 { color: #374151; }
          .text-gray-900 { color: #111827; }
          .text-emerald-700 { color: #047857; }
          .text-amber-700 { color: #b45309; }
          .text-red-700 { color: #b91c1c; }
          .text-red-600 { color: #dc2626; }
          .text-sky-700 { color: #0369a1; }
          .bg-emerald-100 { background: #d1fae5; }
          .bg-amber-100 { background: #fef3c7; }
          .bg-red-100 { background: #fee2e2; }
          .bg-sky-100 { background: #e0f2fe; }
          .bg-gray-100 { background: #f3f4f6; }
          .-mt-2\\.5 { margin-top: -10px; }
          .w-12 { width: 48px; }
          .w-24 { width: 96px; }
          .w-60 { width: 240px; }
          @media print {
            body { padding: 16px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `);
  win.document.close();

  win.onload = () => {
    setTimeout(() => {
      win.print();
      win.close();
    }, 250);
  };
}

export function downloadAsPDF(content: HTMLElement | null, filename: string = 'document.pdf'): void {
  if (!content) {
    console.error('PDF content is null');
    return;
  }

  const htmlContent = content.innerHTML;
  if (!htmlContent || htmlContent.trim().length === 0) {
    console.error('PDF content is empty');
    return;
  }

  const win = window.open('', '_blank');
  if (!win) {
    console.error('Failed to open PDF window');
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${filename}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; padding: 32px; color: #111; font-size: 13px; line-height: 1.5; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 6px 8px; }
          .border-b-2 { border-bottom: 2px solid #111; }
          .border-b { border-bottom: 1px solid #e5e7eb; }
          .border-t { border-top: 1px solid #e5e7eb; }
          .border-t-2 { border-top: 2px solid #111; }
          .border-dashed { border-style: dashed; }
          .border-gray-200 { border-color: #e5e7eb; }
          .border-gray-300 { border-color: #d1d5db; }
          .grid { display: grid; }
          .grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
          .gap-4 { gap: 16px; }
          .bg-gray-50 { background: #f9fafb; border-radius: 8px; padding: 12px; }
          .bg-white { background: white; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .text-left { text-align: left; }
          .ml-auto { margin-left: auto; width: 240px; }
          .font-bold { font-weight: 700; }
          .font-semibold { font-weight: 600; }
          .font-extrabold { font-weight: 800; }
          .font-medium { font-weight: 500; }
          .text-xs { font-size: 11px; }
          .text-sm { font-size: 13px; }
          .text-base { font-size: 15px; }
          .text-lg { font-size: 18px; }
          .text-2xl { font-size: 22px; }
          .uppercase { text-transform: uppercase; }
          .tracking-widest { letter-spacing: 0.1em; }
          .tracking-wide { letter-spacing: 0.05em; }
          .tracking-tight { letter-spacing: -0.025em; }
          .italic { font-style: italic; }
          .mb-0\\.5 { margin-bottom: 2px; }
          .mt-0\\.5 { margin-top: 2px; }
          .mb-1 { margin-bottom: 4px; }
          .mt-1 { margin-top: 4px; }
          .mb-2 { margin-bottom: 8px; }
          .mt-2 { margin-top: 8px; }
          .mb-3 { margin-bottom: 12px; }
          .mt-3 { margin-top: 12px; }
          .mb-4 { margin-bottom: 16px; }
          .mt-4 { margin-top: 16px; }
          .mb-5 { margin-bottom: 20px; }
          .mt-5 { margin-top: 20px; }
          .mt-6 { margin-top: 24px; }
          .my-5 { margin-top: 20px; margin-bottom: 20px; }
          .pb-4 { padding-bottom: 16px; }
          .pt-1 { padding-top: 4px; }
          .pt-1\\.5 { padding-top: 6px; }
          .pt-2 { padding-top: 8px; }
          .pt-4 { padding-top: 16px; }
          .py-0\\.5 { padding-top: 2px; padding-bottom: 2px; }
          .py-1 { padding-top: 4px; padding-bottom: 4px; }
          .py-1\\.5 { padding-top: 6px; padding-bottom: 6px; }
          .py-2 { padding-top: 8px; padding-bottom: 8px; }
          .px-2 { padding-left: 8px; padding-right: 8px; }
          .px-2\\.5 { padding-left: 10px; padding-right: 10px; }
          .px-3 { padding-left: 12px; padding-right: 12px; }
          .rounded-xl { border-radius: 12px; }
          .rounded-lg { border-radius: 8px; }
          .rounded-full { border-radius: 9999px; }
          .whitespace-pre-wrap { white-space: pre-wrap; }
          .space-y-1\\.5 > * + * { margin-top: 6px; }
          .flex { display: flex; }
          .items-start { align-items: flex-start; }
          .items-center { align-items: center; }
          .justify-between { justify-content: space-between; }
          .justify-center { justify-content: center; }
          .gap-3 { gap: 12px; }
          .gap-4 { gap: 16px; }
          .text-gray-400 { color: #9ca3af; }
          .text-gray-500 { color: #6b7280; }
          .text-gray-600 { color: #4b5563; }
          .text-gray-700 { color: #374151; }
          .text-gray-900 { color: #111827; }
          .text-emerald-700 { color: #047857; }
          .text-amber-700 { color: #b45309; }
          .text-red-700 { color: #b91c1c; }
          .text-red-600 { color: #dc2626; }
          .text-sky-700 { color: #0369a1; }
          .bg-emerald-100 { background: #d1fae5; }
          .bg-amber-100 { background: #fef3c7; }
          .bg-red-100 { background: #fee2e2; }
          .bg-sky-100 { background: #e0f2fe; }
          .bg-gray-100 { background: #f3f4f6; }
          .-mt-2\\.5 { margin-top: -10px; }
          .w-12 { width: 48px; }
          .w-24 { width: 96px; }
          .w-60 { width: 240px; }
          @media print {
            @page { size: A4; margin: 10mm; }
            body { padding: 0; }
          }
        </style>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
          window.onafterprint = function() {
            window.close();
          };
        </script>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `);
  win.document.close();
}
