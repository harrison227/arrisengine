import React, { useState, useRef, useLayoutEffect } from 'react';
import { Send, Loader2, Bot, User, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  placeholder?: string;
  clientName?: string;
  footer?: React.ReactNode;
}

export function AIChat({
  messages,
  onSendMessage,
  isLoading,
  placeholder = "Type your message...",
  clientName,
  footer,
}: AIChatProps) {
  const [input, setInput] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatInlineMarkdown = (text: string): React.ReactNode[] => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const formatMessage = (content: string) => {
    const cleanContent = content.replace(/```json[\s\S]*?```/g, '[Plan generated - see preview →]');
    
    const lines = cleanContent.split('\n');
    const elements: React.ReactNode[] = [];
    
    lines.forEach((line, i) => {
      if (line.startsWith('### ')) {
        elements.push(<h5 key={i} className="font-medium text-sm mt-3 mb-1">{formatInlineMarkdown(line.slice(4))}</h5>);
      } else if (line.startsWith('## ')) {
        elements.push(<h4 key={i} className="font-medium mt-3 mb-1">{formatInlineMarkdown(line.slice(3))}</h4>);
      } else if (line.startsWith('# ')) {
        elements.push(<h3 key={i} className="text-base font-semibold mt-3 mb-2">{formatInlineMarkdown(line.slice(2))}</h3>);
      } else if (line.match(/^[-•]\s/)) {
        elements.push(<li key={i} className="ml-4 list-disc list-inside">{formatInlineMarkdown(line.slice(2))}</li>);
      } else if (line.match(/^\d+\.\s/)) {
        const text = line.replace(/^\d+\.\s/, '');
        elements.push(<li key={i} className="ml-4 list-decimal list-inside">{formatInlineMarkdown(text)}</li>);
      } else if (line.trim() === '') {
        elements.push(<div key={i} className="h-2" />);
      } else {
        elements.push(<p key={i} className="leading-relaxed">{formatInlineMarkdown(line)}</p>);
      }
    });
    
    return elements;
  };

  const conversationStarters = [
    "What's a good content strategy for this month?",
    "Suggest 5 video ideas for social media",
    "Plan a filming day with shot lists",
    "What trending formats should we try?"
  ];

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollAreaRef}>
        <div className="max-w-3xl mx-auto px-6 py-8">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {clientName ? `Planning for ${clientName}` : 'Content Planner'}
              </h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                I can help you plan filming days, generate content ideas, and create shot lists based on your client's knowledge base.
              </p>
              
              {/* Conversation Starters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                {conversationStarters.map((starter, index) => (
                  <button
                    key={index}
                    onClick={() => onSendMessage(starter)}
                    disabled={isLoading}
                    className="text-left p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors text-sm text-foreground"
                  >
                    <Sparkles className="w-4 h-4 text-primary mb-1" />
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex gap-4",
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <div className="space-y-1">
                        {formatMessage(message.content)}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                  
                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-4 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-1">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input - Fixed at Bottom */}
      <div className="flex-shrink-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {footer}
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-6 pt-2 pb-1">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="min-h-[52px] max-h-[200px] resize-none pr-12 rounded-xl"
                disabled={isLoading}
                rows={1}
              />
              <Button 
                type="submit" 
                size="icon" 
                disabled={!input.trim() || isLoading}
                className="absolute right-2 bottom-2 h-8 w-8 rounded-lg"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-center">
            Press Enter to send · Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
}
