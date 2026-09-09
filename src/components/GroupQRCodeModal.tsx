import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Group } from '../types.ts';
import { Copy, Check, Download, X, QrCode, Share2 } from 'lucide-react';

interface Props {
  group: Group | null;
  onClose: () => void;
}

export const GroupQRCodeModal: React.FC<Props> = ({ group, onClose }) => {
  const [qrUrl, setQrUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!group) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const joinUrl = `${origin}/?portal=parent&code=${group.code}`;

    QRCode.toDataURL(joinUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#1e293b',
        light: '#ffffff',
      },
    })
      .then((url) => setQrUrl(url))
      .catch((err) => console.error('QR code generation error:', err));
  }, [group]);

  if (!group) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const joinUrl = `${origin}/?portal=parent&code=${group.code}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    if (!qrUrl) return;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `QR_ThamGia_${group.code}.png`;
    a.click();
  };

  return (
    <div
      id="qr-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="qr-modal-card"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2 text-indigo-700 font-semibold text-lg">
            <QrCode className="w-5 h-5" />
            <span>Mã QR & Link Tham Gia Nhóm</span>
          </div>
          <button
            id="btn-close-qr-modal"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 text-center">
          <h3 className="text-xl font-bold text-slate-800">{group.name}</h3>
          <p className="text-sm text-slate-500 mt-1">
            {group.subject} • {group.grade} • Sĩ số tối đa: {group.maxStudents} HS
          </p>

          <div className="my-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 font-mono font-bold text-sm tracking-wide">
            <span>MÃ NHÓM:</span>
            <span className="text-base text-indigo-600 font-black">{group.code}</span>
          </div>

          <div className="flex justify-center p-3 bg-slate-50 rounded-xl border border-slate-200 my-2">
            {qrUrl ? (
              <img
                src={qrUrl}
                alt={`QR code for ${group.name}`}
                className="w-56 h-56 rounded-lg shadow-xs"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-slate-400">
                Đang tạo mã QR...
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Phụ huynh quét mã này trên Zalo/Camera điện thoại để vào trực tiếp trang gửi lịch rảnh cho con.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          <div className="relative">
            <input
              type="text"
              readOnly
              value={joinUrl}
              className="w-full text-xs font-mono bg-slate-100 border border-slate-200 rounded-lg py-2.5 pl-3 pr-24 text-slate-700 focus:outline-hidden"
            />
            <button
              id="btn-copy-join-link"
              onClick={handleCopy}
              className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-medium flex items-center gap-1 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
            </button>
          </div>

          <div className="flex gap-2">
            <button
              id="btn-download-qr"
              onClick={handleDownload}
              className="flex-1 py-2.5 px-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Tải ảnh QR</span>
            </button>
            <button
              id="btn-share-link"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: `Tham gia nhóm học ${group.name}`,
                    text: `Kính mời phụ huynh tham gia và chọn lịch học cho con trong nhóm ${group.name} (Mã: ${group.code}):`,
                    url: joinUrl,
                  }).catch(() => {});
                } else {
                  handleCopy();
                }
              }}
              className="flex-1 py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
            >
              <Share2 className="w-4 h-4" />
              <span>Gửi cho phụ huynh</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
