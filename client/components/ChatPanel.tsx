"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Smile, Paperclip, ChevronDown, Sparkles, Loader2, MessageSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionItemsTab, type ClientActionItem } from "@/components/ActionItemsTab";

// ── Types ──
export interface ChatMessage {
    id: string;
    sender: string;
    text: string;
    timestamp: number;
    isLocal?: boolean;
    messageType?: "text" | "image";
    imageData?: string;
}

interface ChatPanelProps {
    messages: ChatMessage[];
    onSend: (text: string, messageType?: "text" | "image", imageData?: string) => void;
    onClose: () => void;
    localUsername: string;
    suggestions?: string[];
    loadingSuggestions?: boolean;
    onRequestSuggestions?: () => void;
    currentTranscript?: string;
    actionItems?: ClientActionItem[];
    actionItemsLoading?: boolean;
    onExportActionItems?: () => void;
}

// ── Emoji Data ──
const emojiCategories = [
    {
        name: "Smileys",
        emojis: ["😀", "😁", "😂", "🤣", "😊", "😇", "😍", "🤩", "😘", "😋", "😜", "🤔", "🤫", "😏", "😢", "😭", "😤", "😱", "🤯", "😴", "🥳", "😎", "🤓", "🥺", "😈", "💀", "🤡", "👻", "😺", "🙈"],
    },
    {
        name: "Gestures",
        emojis: ["👋", "🤚", "✋", "🖐️", "👌", "🤌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "👍", "👎", "✊", "👊", "🤛", "🙌", "👏", "🤝", "🙏", "💪", "🦾", "🖕", "✍️", "🤳", "💅"],
    },
    {
        name: "Hearts",
        emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "♥️", "❣️", "💌", "🫶", "🥰", "😍", "😘", "😻", "💑", "💏", "🌹"],
    },
    {
        name: "Objects",
        emojis: ["🔥", "⭐", "✨", "💫", "🌟", "⚡", "💥", "🎉", "🎊", "🏆", "🎯", "🎮", "🎧", "🎤", "🎬", "📱", "💻", "⌨️", "🖥️", "📷", "🔔", "📌", "📎", "✏️", "📝", "💡", "🔑", "🚀", "💎", "🍕"],
    },
];

// ── Component ──
export function ChatPanel({ messages, onSend, onClose, localUsername, suggestions, loadingSuggestions, onRequestSuggestions, currentTranscript, actionItems = [], actionItemsLoading, onExportActionItems }: ChatPanelProps) {
    const [input, setInput] = useState("");
    const [showEmoji, setShowEmoji] = useState(false);
    const [emojiCat, setEmojiCat] = useState(0);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const emojiRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!showScrollBtn) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, showScrollBtn]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const handleScroll = () => {
            const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            setShowScrollBtn(distFromBottom > 100);
        };
        el.addEventListener("scroll", handleScroll);
        return () => el.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
                setShowEmoji(false);
            }
        };
        if (showEmoji) document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showEmoji]);

    const scrollToBottom = () => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleSend = () => {
        if (imagePreview) {
            onSend("📷 Image", "image", imagePreview);
            setImagePreview(null);
            return;
        }
        const trimmed = input.trim();
        if (!trimmed) return;
        onSend(trimmed, "text");
        setInput("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleEmojiClick = (emoji: string) => {
        setInput(prev => prev + emoji);
        setShowEmoji(false);
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert("Image must be under 5MB");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
        e.target.value = "";
    };

    const formatTime = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    const shouldGroup = (curr: ChatMessage, prev?: ChatMessage) => {
        if (!prev) return false;
        if (curr.sender !== prev.sender) return false;
        if (curr.isLocal !== prev.isLocal) return false;
        if (curr.timestamp - prev.timestamp > 120000) return false;
        return true;
    };

    const [lightboxImg, setLightboxImg] = useState<string | null>(null);

    return (
        <div className="relative flex h-full flex-col border-l border-[rgb(255_255_255/0.06)] bg-[rgb(17_17_21/0.92)] backdrop-blur-[24px]">
            {/* ── Header ── */}
            <div className="flex shrink-0 items-center justify-between border-b border-[rgb(255_255_255/0.06)] px-4 py-3">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-[#f1f1f3]" style={{ fontFamily: "var(--font-geist), var(--font-body), ui-sans-serif, system-ui, sans-serif" }}>
                        Meeting Sidebar
                    </h3>
                    <span className="grid place-items-center rounded-full bg-[rgb(0_217_245/0.14)] px-2 py-0.5 text-[10px] font-semibold text-[#00d9f5]" style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}>
                        {messages.length}
                    </span>
                </div>
                <button
                    onClick={onClose}
                    className="rounded-lg p-1.5 text-[#8b8b9a] transition-colors hover:bg-[rgb(255_255_255/0.06)] hover:text-[#f1f1f3]"
                    aria-label="Close meeting sidebar"
                >
                    <X size={16} />
                </button>
            </div>

            <Tabs defaultValue="chat" className="flex min-h-0 flex-1 flex-col">
                <div className="border-b border-[rgb(255_255_255/0.06)] px-3 py-2">
                    <TabsList className="grid w-full grid-cols-2 bg-[rgb(255_255_255/0.04)] rounded-lg p-0.5">
                        <TabsTrigger value="chat" className="rounded-md text-xs data-[state=active]:bg-[rgb(0_217_245/0.14)] data-[state=active]:text-[#00d9f5] data-[state=active]:shadow-none">Chat</TabsTrigger>
                        <TabsTrigger value="actions" className="rounded-md text-xs data-[state=active]:bg-[rgb(0_217_245/0.14)] data-[state=active]:text-[#00d9f5] data-[state=active]:shadow-none">Action Items</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="chat" className="relative mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
                    {/* ── Messages ── */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-1 min-h-0">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-[#8b8b9a] gap-2">
                                <div className="grid size-12 place-items-center rounded-xl border border-[rgb(255_255_255/0.06)] bg-[rgb(255_255_255/0.03)]">
                                    <MessageSquare size={22} />
                                </div>
                                <p className="text-xs font-medium">No messages yet</p>
                                <p className="text-[10px]">Send context without interrupting the speaker.</p>
                            </div>
                        )}
                        {messages.map((msg, i) => {
                            const grouped = shouldGroup(msg, messages[i - 1]);
                            return (
                                <div
                                    key={msg.id}
                                    className={`flex flex-col ${msg.isLocal ? "items-end" : "items-start"} ${grouped ? "" : "mt-3"}`}
                                >
                                    {!grouped && (
                                        <div className="flex items-center gap-1.5 mb-1 px-1">
                                            <span className="text-[10px] font-semibold text-[#8b8b9a]">
                                                {msg.isLocal ? localUsername || "You" : msg.sender}
                                            </span>
                                            <span className="text-[9px] text-[#8b8b9a]/50">
                                                {formatTime(msg.timestamp)}
                                            </span>
                                        </div>
                                    )}

                                    {msg.messageType === "image" && msg.imageData ? (
                                        <div
                                            className={`max-w-[85%] rounded-2xl overflow-hidden border border-[rgb(255_255_255/0.06)] cursor-pointer hover:opacity-90 transition-opacity ${msg.isLocal ? "rounded-br-md" : "rounded-bl-md"}`}
                                            onClick={() => setLightboxImg(msg.imageData!)}
                                        >
                                            <img src={msg.imageData} alt="Shared" className="max-h-48 object-cover" loading="lazy" />
                                        </div>
                                    ) : (
                                        <div
                                            className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${msg.isLocal
                                                ? "bg-[rgb(0_217_245/0.14)] text-[#f1f1f3] rounded-br-md"
                                                : "bg-[#111115] text-[#f1f1f3] rounded-bl-md"
                                                }`}
                                        >
                                            {msg.text}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        <div ref={bottomRef} />
                    </div>

                    {showScrollBtn && (
                        <button
                            onClick={scrollToBottom}
                            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#f1f1f3] text-[#060608] text-xs font-semibold shadow-lg hover:opacity-90 transition-all"
                        >
                            <ChevronDown size={14} /> New messages
                        </button>
                    )}

                    {/* AI Reply Suggestions */}
                    {(suggestions && suggestions.length > 0) && (
                        <div className="shrink-0 border-t border-[rgb(255_255_255/0.06)] bg-[rgb(167_139_250/0.06)] px-3 py-2">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <Sparkles size={12} className="text-[#a78bfa]" />
                                <span className="text-[10px] font-semibold uppercase text-[#a78bfa]" style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}>From meeting voice</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {suggestions.map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() => { onSend(s, "text"); }}
                                        className="rounded-full border border-[#a78bfa]/30 bg-[rgb(167_139_250/0.14)] px-3 py-1.5 text-xs font-medium text-[#a78bfa] transition-all hover:bg-[rgb(167_139_250/0.25)] active:scale-95"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Live Transcript Strip */}
                    {currentTranscript && (
                        <div className="px-3 py-1.5 border-t border-[rgb(255_255_255/0.06)] bg-[rgb(255_255_255/0.02)] shrink-0">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#00d9f5] animate-pulse" />
                                <span className="text-[10px] text-[#8b8b9a] italic truncate" style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}>{currentTranscript}</span>
                            </div>
                        </div>
                    )}

                    {/* Image Preview */}
                    {imagePreview && (
                        <div className="px-3 py-2 border-t border-[rgb(255_255_255/0.06)] bg-[rgb(255_255_255/0.03)] shrink-0">
                            <div className="relative inline-block">
                                <img src={imagePreview} alt="Preview" className="max-h-24 rounded-lg border border-[rgb(255_255_255/0.06)]" />
                                <button
                                    onClick={() => setImagePreview(null)}
                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#f5223a] text-white rounded-full flex items-center justify-center text-[10px] font-bold hover:opacity-80"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Composer ── */}
                    <div className="shrink-0 px-3 py-3 border-t border-[rgb(255_255_255/0.06)]">
                        <div className="flex items-center gap-1.5 rounded-xl border border-[rgb(255_255_255/0.06)] bg-[rgb(255_255_255/0.03)] px-2 py-1.5 transition-all focus-within:border-[rgb(0_217_245/0.3)]">
                            <div className="relative" ref={emojiRef}>
                                <button
                                    onClick={() => setShowEmoji(!showEmoji)}
                                    className={`rounded-lg p-1.5 transition-colors ${showEmoji ? "bg-[rgb(0_217_245/0.14)] text-[#00d9f5]" : "text-[#8b8b9a] hover:bg-[rgb(255_255_255/0.06)] hover:text-[#f1f1f3]"}`}
                                    title="Emoji"
                                >
                                    <Smile size={18} />
                                </button>

                                {showEmoji && (
                                    <div className="absolute bottom-full left-0 z-50 mb-2 w-72 overflow-hidden rounded-xl border border-[rgb(255_255_255/0.06)] bg-[#111115] shadow-lg backdrop-blur-xl">
                                        <div className="flex border-b border-[rgb(255_255_255/0.06)]">
                                            {emojiCategories.map((cat, i) => (
                                                <button
                                                    key={cat.name}
                                                    onClick={() => setEmojiCat(i)}
                                                    className={`flex-1 py-2 text-[10px] font-semibold uppercase transition-colors ${i === emojiCat
                                                        ? "text-[#00d9f5] border-b-2 border-[#00d9f5] bg-[rgb(0_217_245/0.06)]"
                                                        : "text-[#8b8b9a] hover:text-[#f1f1f3]"
                                                        }`}
                                                >
                                                    {cat.name}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-8 gap-0.5 p-2 max-h-44 overflow-y-auto">
                                            {emojiCategories[emojiCat].emojis.map((emoji) => (
                                                <button
                                                    key={emoji}
                                                    onClick={() => handleEmojiClick(emoji)}
                                                    className="p-1.5 rounded-lg hover:bg-[rgb(255_255_255/0.06)] transition-colors text-lg leading-none"
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-1.5 rounded-lg text-[#8b8b9a] hover:text-[#f1f1f3] hover:bg-[rgb(255_255_255/0.06)] transition-colors"
                                title="Send image"
                            >
                                <Paperclip size={18} />
                            </button>

                            {onRequestSuggestions && (
                                <button
                                    onClick={onRequestSuggestions}
                                    disabled={loadingSuggestions}
                                    className={`rounded-lg p-1.5 transition-colors ${loadingSuggestions ? 'text-[#a78bfa] animate-pulse' : 'text-[#8b8b9a] hover:bg-[rgb(167_139_250/0.1)] hover:text-[#a78bfa]'}`}
                                    title="AI suggest replies"
                                >
                                    {loadingSuggestions ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                                </button>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleImageSelect}
                            />

                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={imagePreview ? "Send image..." : "Type a message..."}
                                className="flex-1 bg-transparent text-sm text-[#f1f1f3] outline-none placeholder:text-[#8b8b9a]/50 min-w-0"
                                maxLength={500}
                            />

                            <button
                                onClick={handleSend}
                                disabled={!input.trim() && !imagePreview}
                                className="rounded-lg bg-[#00d9f5] p-2 text-[#060608] transition-all hover:opacity-90 disabled:opacity-30"
                                aria-label="Send message"
                            >
                                <Send size={15} />
                            </button>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="actions" className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden">
                    <ActionItemsTab
                        items={actionItems}
                        isLoading={actionItemsLoading}
                        onExportMarkdown={onExportActionItems || (() => { })}
                    />
                </TabsContent>
            </Tabs>

            {/* ── Lightbox ── */}
            {lightboxImg && (
                <div
                    className="fixed inset-0 z-[300] flex items-center justify-center bg-[#060608]/85 backdrop-blur-sm"
                    onClick={() => setLightboxImg(null)}
                >
                    <img
                        src={lightboxImg}
                        alt="Full view"
                        className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl object-contain"
                    />
                    <button
                        className="absolute right-6 top-6 rounded-full bg-[rgb(255_255_255/0.1)] p-2 text-[#f1f1f3] transition-colors hover:bg-[rgb(255_255_255/0.2)]"
                        onClick={() => setLightboxImg(null)}
                        aria-label="Close image preview"
                    >
                        <X size={20} />
                    </button>
                </div>
            )}
        </div>
    );
}
