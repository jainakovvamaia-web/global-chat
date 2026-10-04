import styles from "./MessageItem.module.css";

const MENTION_PATTERN = /(@[\w.]+)/g;

// Текст сообщения с подсветкой упоминаний вида @слово.
// Список настоящих логинов участников сюда не передаётся — чат не должен их знать.
export default function MessageText({ content }: { content: string }) {
  // split с группой в скобках кладёт найденные упоминания на нечётные позиции массива
  return content.split(MENTION_PATTERN).map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className={styles.mention}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}
