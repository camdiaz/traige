interface Props {
  message: string;
  visible: boolean;
}

export function Toast({ message, visible }: Props) {
  return (
    <div className={`toast${visible ? ' on' : ''}`}>{message}</div>
  );
}
