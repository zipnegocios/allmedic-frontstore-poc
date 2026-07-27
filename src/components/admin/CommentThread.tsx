'use client';

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
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

interface MentionCandidate {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

type CommentThreadProps =
  | { mode: 'task'; taskId: string; entityType?: never; entityId?: never }
  | { mode: 'entity'; entityType: 'PRODUCT' | 'VARIANT' | 'SET' | 'MEDIA'; entityId: string; taskId?: never };

/** Resalta `@Nombre Completo` cuando coincide con un candidato conocido, sin tocar el texto guardado. */
function renderBodyWithMentions(body: string, candidates: MentionCandidate[]) {
  if (candidates.length === 0) return body;
  const names = candidates
    .map((c) => c.name)
    .filter((n): n is string => !!n)
    .sort((a, b) => b.length - a.length);
  if (names.length === 0) return body;

  const pattern = new RegExp(`@(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  const parts: Array<string | { mention: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    if (match.index > lastIndex) parts.push(body.slice(lastIndex, match.index));
    parts.push({ mention: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < body.length) parts.push(body.slice(lastIndex));

  return parts.map((part, i) =>
    typeof part === 'string' ? (
      <Fragment key={i}>{part}</Fragment>
    ) : (
      <span key={i} className="text-blue-600 font-medium">
        {part.mention}
      </span>
    )
  );
}

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
  const [mentionedUserIds, setMentionedUserIds] = useState<Set<string>>(new Set());
  const [candidates, setCandidates] = useState<MentionCandidate[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    fetch('/api/admin/mentions/candidates')
      .then((res) => (res.ok ? res.json() : { candidates: [] }))
      .then((data) => setCandidates(data.candidates ?? []))
      .catch(() => setCandidates([]));
  }, []);

  const filteredCandidates = mentionQuery === null
    ? []
    : candidates
        .filter((c) => (c.name ?? c.email).toLowerCase().includes(mentionQuery.toLowerCase()))
        .slice(0, 6);

  function handleDraftChange(value: string, cursorPos: number) {
    setDraft(value);
    const upToCursor = value.slice(0, cursorPos);
    const atIndex = upToCursor.lastIndexOf('@');
    if (atIndex === -1) {
      setMentionQuery(null);
      return;
    }
    const afterAt = upToCursor.slice(atIndex + 1);
    if (/\s/.test(afterAt)) {
      setMentionQuery(null);
      return;
    }
    setMentionQuery(afterAt);
    setMentionIndex(0);
  }

  function selectMention(candidate: MentionCandidate) {
    const textarea = textareaRef.current;
    const cursorPos = textarea ? textarea.selectionStart : draft.length;
    const upToCursor = draft.slice(0, cursorPos);
    const atIndex = upToCursor.lastIndexOf('@');
    if (atIndex === -1) return;

    const label = candidate.name ?? candidate.email;
    const before = draft.slice(0, atIndex);
    const after = draft.slice(cursorPos);
    const insertion = `@${label} `;
    const nextValue = `${before}${insertion}${after}`;
    setDraft(nextValue);
    setMentionedUserIds((prev) => new Set(prev).add(candidate.id));
    setMentionQuery(null);

    requestAnimationFrame(() => {
      if (!textarea) return;
      const nextCursor = before.length + insertion.length;
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery === null || filteredCandidates.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex((i) => (i + 1) % filteredCandidates.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex((i) => (i - 1 + filteredCandidates.length) % filteredCandidates.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectMention(filteredCandidates[mentionIndex]);
    } else if (e.key === 'Escape') {
      setMentionQuery(null);
    }
  }

  async function handleSend() {
    if (!draft.trim()) return;
    setSending(true);
    try {
      const postEndpoint = props.mode === 'task'
        ? `/api/admin/tasks/${props.taskId}/comments`
        : '/api/admin/entity-comments';
      const basePayload = props.mode === 'task'
        ? { body: draft }
        : { entityType: props.entityType, entityId: props.entityId, body: draft };
      const payload = { ...basePayload, mentionedUserIds: [...mentionedUserIds] };

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
      setMentionedUserIds(new Set());
      setMentionQuery(null);
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
              <p className="text-gray-800 whitespace-pre-wrap">{renderBodyWithMentions(comment.body, candidates)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value, e.target.selectionStart)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un comentario... usa @ para mencionar"
            rows={2}
            className="flex-1"
          />
          <Button size="sm" onClick={handleSend} disabled={sending || !draft.trim()}>Enviar</Button>
        </div>

        {mentionQuery !== null && filteredCandidates.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm divide-y divide-gray-100 overflow-hidden">
            {filteredCandidates.map((candidate, i) => (
              <button
                key={candidate.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectMention(candidate);
                }}
                className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between ${i === mentionIndex ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <span className="text-gray-800">{candidate.name ?? candidate.email}</span>
                <span className="text-[11px] text-gray-400">{candidate.role === 'ADMIN' ? 'Admin' : 'Gestor'}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
