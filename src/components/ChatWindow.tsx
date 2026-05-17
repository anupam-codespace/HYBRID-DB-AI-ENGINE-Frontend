import { useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatBubble } from '@/components/ChatBubble'
import { ChatInput } from '@/components/ChatInput'
import { useAppStore } from '@/store/appStore'

function EmptyState() {
  return (
    <div className="flex flex-col items-center w-full select-none text-center px-4">
      <h1 className="text-[28px] sm:text-[40px] font-medium leading-tight tracking-tight text-foreground">
        Hi there
      </h1>
      <h2 className="text-[28px] sm:text-[40px] font-medium leading-tight tracking-tight text-muted-foreground">
        Ready to design your database?
      </h2>
    </div>
  )
}

export function ChatWindow() {
  const { messages } = useAppStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col h-full bg-background relative">
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-20 sm:pb-0">
          <div className="w-full max-w-3xl mx-auto flex flex-col gap-8">
            <EmptyState />
            <div className="w-full relative z-10 shadow-2xl rounded-2xl">
              <ChatInput />
            </div>
          </div>
        </div>
      ) : (
        <>
          <ScrollArea className="flex-1 px-4 md:px-8 lg:px-32 xl:px-64">
            <div className="py-6 flex flex-col gap-6">
              {messages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} />
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Input bar at bottom when chat is active */}
          <div className="px-4 md:px-8 lg:px-32 xl:px-64 py-3 sm:py-4 bg-background chat-input-bottom">
            <ChatInput />
          </div>
        </>
      )}
    </div>
  )
}
