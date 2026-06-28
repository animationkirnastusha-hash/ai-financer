type Props = {
  prompts: string[];
  title: string;
  caption: string;
  onPrompt: (prompt: string) => void;
};

export function TextChatEmptyState({
  prompts,
  title,
  caption,
  onPrompt,
}: Props) {
  return (
    <div className="text-chat-overlay__empty text-chat-overlay__empty--reminder">
      <div className="text-chat-overlay__orb" aria-hidden="true">⌁</div>
      <h3>{title}</h3>
      <p>{caption}</p>
      {prompts.length ? (
        <div className="text-chat-overlay__chips">
          {prompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => onPrompt(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
