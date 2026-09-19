import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, AlertTriangle, Info, ShieldAlert } from 'lucide-react';

interface NotificationProps {
    id: number;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    onClose: (id: number) => void;
}

export default function NotificationItem({ id, type, title, message, onClose }: NotificationProps) {
    const [isHovered, setIsHovered] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!isHovered) {
            timerRef.current = setTimeout(() => {
                onClose(id);
            }, 3000);
        } else {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [isHovered, id, onClose]);

    const typeStyles = {
        success: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 shadow-emerald-950/20',
        error: 'bg-red-500/10 border-red-500/25 text-red-400 shadow-red-950/20',
        warning: 'bg-amber-500/10 border-amber-500/25 text-amber-400 shadow-amber-950/20',
        info: 'bg-blue-500/10 border-blue-500/25 text-blue-400 shadow-blue-950/20',
    };

    const Icon = {
        success: CheckCircle,
        error: ShieldAlert,
        warning: AlertTriangle,
        info: Info,
    }[type];

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`p-4 rounded-xl border shadow-2xl pointer-events-auto flex items-center justify-between gap-4 w-full transition-all duration-300 transform scale-100 hover:scale-[1.02] ${typeStyles[type]}`}
        >
            <div className="flex items-start gap-3">
                <Icon size={16} className="shrink-0 mt-0.5" />
                <div>
                    {/* Estilo y tamaño de fuente incrementados para máxima legibilidad */}
                    <p className="font-extrabold text-xs uppercase tracking-wider">{title}</p>
                    <p className="text-xs text-slate-300 font-medium leading-relaxed mt-1">{message}</p>
                </div>
            </div>
            <button
                onClick={() => onClose(id)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
            >
                <X size={14} />
            </button>
        </div>
    );
}