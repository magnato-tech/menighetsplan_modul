import React, { useState, useRef, useEffect } from "react";
import { useGroupRoom, formatChatMessageTime } from "../hooks/useAppHooks";
import { GroupMessage } from "../types";
import { useTimedMessage } from "../hooks/useTimedMessage";
import {
  Send,
  Trash2,
  Bell,
  BellOff,
  ExternalLink,
  Play,
  X,
  Lock,
  ZoomIn,
  Smile,
  Info,
  Camera,
} from "lucide-react";

// Helper to extract URLs
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

// Helper to check if URL is YouTube
function getYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      return parsed.searchParams.get("v");
    }
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.slice(1);
    }
    return null;
  } catch {
    return null;
  }
}

// Component to render text with clickable links and YouTube previews
const RichMessageContent: React.FC<{
  content: string;
  isCurrentUser: boolean;
}> = ({ content, isCurrentUser }) => {
  const parts = content.split(URL_REGEX);

  // Collect YouTube links for video preview chips
  const youtubeLinks: { url: string; videoId: string | null }[] = [];

  const renderedText = parts.map((part, i) => {
    if (part.match(URL_REGEX)) {
      const ytId = getYouTubeVideoId(part);
      if (ytId && !youtubeLinks.some((y) => y.url === part)) {
        youtubeLinks.push({ url: part, videoId: ytId });
      }

      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center gap-0.5 underline font-medium break-all hover:opacity-80 transition-opacity ${
            isCurrentUser
              ? "text-emerald-100 hover:text-white"
              : "text-emerald-700 hover:text-emerald-900"
          }`}
        >
          <span>{part}</span>
          <ExternalLink className="w-3 h-3 inline-block shrink-0 ml-0.5" />
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });

  return (
    <div className="space-y-2">
      <div className="text-xs leading-relaxed whitespace-pre-wrap break-words">
        {renderedText}
      </div>

      {/* YouTube Video Preview Cards */}
      {youtubeLinks.map((yt, idx) => (
        <a
          key={idx}
          href={yt.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all text-left ${
            isCurrentUser
              ? "bg-emerald-800/40 border-emerald-500/50 hover:bg-emerald-800/60 text-white"
              : "bg-red-50/60 border-red-200/80 hover:bg-red-50 text-slate-800"
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <Play className="w-4 h-4 fill-white ml-0.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-100/80 px-1.5 py-0.2 rounded">
                YouTube
              </span>
            </div>
            <p className="text-[11px] font-medium truncate mt-0.5 opacity-90">
              {yt.url}
            </p>
          </div>
          <ExternalLink className="w-3.5 h-3.5 opacity-60 shrink-0" />
        </a>
      ))}
    </div>
  );
};

export const GroupChat: React.FC<{
  groupId?: string;
}> = ({ groupId }) => {
  const {
    group,
    isMember,
    messages,
    sendMessage,
    deleteMessage,
    notificationsEnabled,
    toggleNotifications,
    currentUser,
  } = useGroupRoom(groupId);

  const [inputContent, setInputContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [feedback, showFeedback, clearFeedback] = useTimedMessage<string>();

  // Lightbox modal state
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    senderName: string;
    time: string;
  } | null>(null);

  // Delete confirmation state
  const [messageToDelete, setMessageToDelete] = useState<GroupMessage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // File input ref for camera/image picker
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Scroll inner chat container to bottom when messages update (strictly contained, no window scrolling)
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages.length]);

  if (!group) {
    return (
      <div className="p-6 text-center text-xs text-slate-400">
        Ingen gruppe funnet.
      </div>
    );
  }

  // Access check: Only group members have access to the confidential room
  if (!isMember) {
    return (
      <div
        id="chat-access-denied"
        className="bg-amber-50/80 border border-amber-200/80 rounded-3xl p-6 text-center space-y-3"
      >
        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700">
          <Lock className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Lukket internt rom
          </h3>
          <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto leading-relaxed">
            Chatten i <strong>{group.name}</strong> er et konfidensielt rom
            forbeholdt gruppens deltakere. Du må være registrert som deltaker for å
            se innholdet.
          </p>
        </div>
      </div>
    );
  }

  // Image selection handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (< 5MB for mock data URL)
    if (file.size > 5 * 1024 * 1024) {
      showFeedback("Bildet er for stort. Maks størrelse er 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Reset input value so same file can be re-selected if needed
    e.target.value = "";
  };

  // Quick preset image selector for convenience
  const handleSelectPresetImage = (url: string) => {
    setSelectedImage(url);
  };

  // Send message
  const handleSend = () => {
    const trimmed = inputContent.trim();
    if (!trimmed && !selectedImage) return;

    setIsSending(true);
    const res = sendMessage(trimmed, selectedImage || undefined);
    setIsSending(false);

    if (res.success) {
      setInputContent("");
      setSelectedImage(null);
    } else if (res.error) {
      showFeedback(res.error);
    }
  };

  // Confirm delete message
  const handleConfirmDelete = () => {
    if (!messageToDelete) return;
    setIsDeleting(true);
    const res = deleteMessage(messageToDelete.id);
    setIsDeleting(false);
    setMessageToDelete(null);

    if (res.success) {
      showFeedback("Meldingen ble slettet.", 2500);
    } else if (res.error) {
      showFeedback(res.error);
    }
  };

  return (
    <div
      id={`group-chat-${group.id}`}
      className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col transition-all"
    >
      {/* Top Header: Chat Info & Notification Toggle */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-slate-800 truncate">
              Felles samtale
            </h3>
            <p className="text-[11px] text-slate-500 truncate">
              {group.name} • {messages.length}{" "}
              {messages.length === 1 ? "melding" : "meldinger"}
            </p>
          </div>
        </div>

        {/* Notification Toggle Button */}
        <button
          type="button"
          id="btn-toggle-notifications"
          onClick={() => toggleNotifications()}
          title={
            notificationsEnabled
              ? `Varsler er på for ${group.name}. Klikk for å slå av.`
              : `Varsler er av for ${group.name}. Klikk for å slå på.`
          }
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            notificationsEnabled
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200/70 hover:bg-emerald-100"
              : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200/70"
          }`}
        >
          {notificationsEnabled ? (
            <>
              <Bell className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-[11px]">Varsler på</span>
            </>
          ) : (
            <>
              <BellOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[11px]">Varsler av</span>
            </>
          )}
        </button>
      </div>

      {/* Notice about privacy & member history */}
      <div className="px-4 py-2 bg-emerald-50/40 border-b border-emerald-100/50 flex items-center gap-2 text-[11px] text-slate-600">
        <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span className="truncate">
          Internt rom. Nye deltakere ser kun meldinger publisert etter at de ble med.
        </span>
      </div>

      {/* Messages Feed Area */}
      <div
        ref={messagesContainerRef}
        id={`chat-messages-container-${group.id}`}
        className="p-4 space-y-3.5 max-h-[420px] min-h-[220px] overflow-y-auto bg-gradient-to-b from-slate-50/30 to-white"
      >
        {messages.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <div className="w-10 h-10 mx-auto rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Smile className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-700">
              Ingen meldinger ennå
            </p>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
              Vær den første til å skrive en hilsen eller dele et bilde med gruppen!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderPersonId === currentUser.id;

            return (
              <div
                key={msg.id}
                id={`chat-msg-${msg.id}`}
                className={`flex flex-col group transition-all ${
                  isMe ? "items-end" : "items-start"
                }`}
              >
                {/* Sender name & time */}
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-500">
                  <span
                    className={`font-bold ${
                      isMe ? "text-emerald-800" : "text-slate-800"
                    }`}
                  >
                    {isMe ? "Deg" : msg.senderName}
                  </span>
                  <span>•</span>
                  <span>{formatChatMessageTime(msg.createdAt)}</span>
                </div>

                {/* Message Bubble Container with Action Buttons */}
                <div className="relative max-w-[85%] group/bubble flex items-start gap-1.5">
                  {/* Delete button (only visible for own messages) */}
                  {isMe && (
                    <button
                      type="button"
                      id={`btn-delete-msg-${msg.id}`}
                      onClick={() => setMessageToDelete(msg)}
                      className="opacity-0 group-hover/bubble:opacity-100 focus:opacity-100 p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-all cursor-pointer self-center"
                      title="Slett melding"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* The Bubble */}
                  <div
                    className={`p-3.5 rounded-2xl space-y-2 shadow-2xs ${
                      isMe
                        ? "bg-emerald-700 text-white rounded-tr-xs"
                        : "bg-slate-100 text-slate-900 rounded-tl-xs"
                    }`}
                  >
                    {/* Attached Image */}
                    {msg.imageUrl && (
                      <div
                        className="relative rounded-xl overflow-hidden cursor-pointer group/img max-w-sm"
                        onClick={() =>
                          setLightboxImage({
                            url: msg.imageUrl!,
                            senderName: msg.senderName,
                            time: formatChatMessageTime(msg.createdAt),
                          })
                        }
                      >
                        <img
                          src={msg.imageUrl}
                          alt="Vedlagt bilde"
                          className="w-full max-h-56 object-cover rounded-xl transition-transform duration-200 group-hover/img:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <ZoomIn className="w-6 h-6 drop-shadow-md" />
                        </div>
                      </div>
                    )}

                    {/* Text content with link formatting */}
                    {msg.content && (
                      <RichMessageContent
                        content={msg.content}
                        isCurrentUser={isMe}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Toast Feedback */}
      {feedback && (
        <div className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold flex items-center justify-between">
          <span>{feedback}</span>
          <button
            type="button"
            onClick={clearFeedback}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Selected Image Preview before sending */}
      {selectedImage && (
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
          <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shrink-0">
            <img
              src={selectedImage}
              alt="Forhåndsvisning"
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              id="btn-remove-selected-image"
              onClick={() => setSelectedImage(null)}
              className="absolute top-1 right-1 p-0.5 bg-black/70 text-white rounded-full hover:bg-black transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="text-xs text-slate-600 flex-1 min-w-0">
            <span className="font-bold block text-slate-800">
              Bilde vedlagt
            </span>
            <span className="text-[11px] text-slate-500">
              Bildet sendes sammen med meldingen.
            </span>
          </div>
        </div>
      )}

      {/* Message Composer Footer */}
      <div className="p-3 bg-white border-t border-slate-100 space-y-2">
        {/* Hidden native file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          id="chat-file-input"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex items-end gap-2">
          {/* Image Upload Button & Presets */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              id="btn-attach-image"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
              title="Velg bilde eller ta bilde med kamera"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* Text Area */}
          <div className="flex-1 min-w-0">
            <textarea
              id="input-chat-message"
              rows={1}
              value={inputContent}
              onChange={(e) => setInputContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`Skriv en melding til ${group.name}...`}
              className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-2xl bg-slate-50 focus:bg-white focus:outline-emerald-600 text-slate-900 resize-none min-h-[40px] max-h-24 leading-normal"
            />
          </div>

          {/* Send Button */}
          <button
            type="button"
            id="btn-send-chat-message"
            disabled={(!inputContent.trim() && !selectedImage) || isSending}
            onClick={handleSend}
            className="p-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 text-white transition-all cursor-pointer shadow-xs disabled:cursor-not-allowed shrink-0"
            title="Send melding"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Test Photo Presets */}
        <div className="flex items-center gap-1.5 pt-1 overflow-x-auto scrollbar-none text-[11px] text-slate-500">
          <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">
            Hurtigbilde:
          </span>
          <button
            type="button"
            onClick={() =>
              handleSelectPresetImage(
                "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80"
              )
            }
            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold transition-colors shrink-0"
          >
            🍕 Fellesskap / Mat
          </button>
          <button
            type="button"
            onClick={() =>
              handleSelectPresetImage(
                "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=800&q=80"
              )
            }
            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold transition-colors shrink-0"
          >
            📖 Bibel & Kaffe
          </button>
          <button
            type="button"
            onClick={() =>
              handleSelectPresetImage(
                "https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=800&q=80"
              )
            }
            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold transition-colors shrink-0"
          >
            ☕ Kaffekos
          </button>
        </div>
      </div>

      {/* Lightbox Zoom Modal */}
      {lightboxImage && (
        <div
          id="modal-chat-lightbox"
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xs flex flex-col items-center justify-center p-4 animate-in fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-2xl max-h-[85vh] w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between text-white pb-3 px-1">
              <div>
                <span className="text-xs font-bold block">
                  {lightboxImage.senderName}
                </span>
                <span className="text-[10px] text-slate-400">
                  {lightboxImage.time}
                </span>
              </div>
              <button
                type="button"
                id="btn-close-lightbox"
                onClick={() => setLightboxImage(null)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={lightboxImage.url}
              alt="Forstørret bilde"
              className="max-h-[75vh] w-auto object-contain rounded-2xl shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {messageToDelete && (
        <div
          id="modal-delete-chat-message"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-3xl p-5 max-w-xs w-full space-y-4 shadow-xl border border-slate-100">
            <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Slette melding?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Er du sikker på at du vil slette denne meldingen? Handlingen kan ikke angres.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                id="btn-cancel-delete-msg"
                onClick={() => setMessageToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Avbryt
              </button>
              <button
                type="button"
                id="btn-confirm-delete-msg"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                {isDeleting ? "Sletter..." : "Slett"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
