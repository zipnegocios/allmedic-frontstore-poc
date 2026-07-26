'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { MessageSquare } from 'lucide-react';

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string | null;
}

type CommentThreadProps =
  | { mode: 'task'; taskId: string; entityType?: never; entityId?: never }
  | { mode: 'entity'; entityType: 'PRODUCT' | 'VARIANT' | 'SET' | 'MEDIA'; entityId: string; taskId?: never };

/**
 * Componente único para los dos hilos de comentarios del plan (decisión 2): por tarea
 * (`mode: 'task'`) o por entidad producto/set (`mode: 'entity'`) — sin duplicar UI entre
 * ambos contextos, solo cambia el endpoint que consume.
 */
export function CommentThread(props: CommentThreadProps) {
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id;
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const endpoint = props.mode === 'task'
    ? `/api/admin/tasks/${props.taskId}/comments`
    : `/api/admin/entity-comments?entityType=${props.entityType}&entityId=${props.entityId}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments);
      }
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSend() {
    if (!draft.trim()) return;
    setSending(true);
    try {
      const postEndpoint = props.mode === 'task'
        ? `/api/admin/tasks/${props.taskId}/comments`
        : '/api/admin/entity-comments';
      const payload = props.mode === 'task'
        ? { body: draft }
        : { entityType: props.entityType, entityId: props.entityId, body: draft };

      const res = await fetch(postEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'No se pudo enviar el comentario');
        return;
      }
      setDraft('');
      load();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <MessageSquare className="w-4 h-4 text-gray-400" />
        Comentarios
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400">Sin comentarios todavía.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className={`rounded-lg p-2.5 text-sm ${comment.authorId === currentUserId ? 'bg-blue-50 ml-6' : 'bg-gray-50 mr-6'}`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-medium text-xs text-gray-600">{comment.authorName ?? 'Usuario'}</span>
                <span className="text-[11px] text-gray-400">{new Date(comment.createdAt).toLocaleString('es-EC')}</span>
              </div>
              <p className="text-gray-800 whitespace-pre-wrap">{comment.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escribe un comentario..."
          rows={2}
          className="flex-1"
        />
        <Button size="sm" onClick={handleSend} disabled={sending || !draft.trim()}>Enviar</Button>
      </div>
    </div>
  );
}
