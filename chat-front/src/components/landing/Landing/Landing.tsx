import Link from "next/link";
import Button from "@/components/ui/Button/Button";
import LogoMark from "@/components/ui/LogoMark/LogoMark";
import { getAvatarColor } from "@/lib/members";
import ChatMockup from "./ChatMockup";
import styles from "./Landing.module.css";

const FEATURES = [
  { emoji: "⚡", title: "Общение в реальном времени", text: "Мгновенная доставка сообщений с поддержкой реакций, ответов и упоминаний" },
  { emoji: "🏘️", title: "Локальные сообщества", text: "Вступай в чаты своей школы, университета, жилого комплекса или района" },
  { emoji: "📌", title: "Тематические каналы", text: "Организуй общение по темам: объявления, учёба, мероприятия, находки и многое другое" },
  { emoji: "📅", title: "Мероприятия и встречи", text: "Создавай события, приглашай участников и координируй встречи внутри сообщества" },
  { emoji: "🤖", title: "AI-помощник", text: "Умный помощник ответит на вопросы по истории чата и создаст краткое резюме обсуждений" },
  { emoji: "📍", title: "Локальные чаты", text: "Общайся с людьми из твоего двора, подъезда, корпуса или любого другого места" },
];

const STEPS = [
  { number: "01", emoji: "👤", title: "Создай аккаунт", text: "Зарегистрируйся за 30 секунд — только имя и email" },
  { number: "02", emoji: "🔍", title: "Выбери сообщество", text: "Найди свою школу, университет, ЖК или компанию" },
  { number: "03", emoji: "💬", title: "Общайся и участвуй", text: "Присоединяйся к каналам, создавай события и находи людей рядом" },
];

const EXAMPLES = [
  { emoji: "🏫", type: "Школа", name: "Школа №61", count: "1 240 участников" },
  { emoji: "🎓", type: "Университет", name: "МГУ, ВМК", count: "3 400 участников" },
  { emoji: "🏠", type: "Жилой комплекс", name: "ЖК «Солнечный»", count: "890 участников" },
  { emoji: "💼", type: "Компания", name: "Яндекс", count: "18 500 сотрудников" },
];

const NAV_LINKS = [
  { href: "#features", label: "Возможности" },
  { href: "#communities", label: "Сообщества" },
  { href: "#how-it-works", label: "О проекте" },
];

// Landing Page из макета: описание продукта, преимущества и переход к регистрации
export default function Landing() {
  return (
    <div className={styles.page}>
      <nav className={styles.navbar}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.brand}>
            <LogoMark size="md" />
            Global Chat
          </Link>
          <div className={styles.navLinks}>
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className={styles.navLink}>
                {link.label}
              </a>
            ))}
          </div>
          <div className={styles.navActions}>
            <Link href="/login" className={styles.loginLink}>
              Войти
            </Link>
            <Button href="/register" size="md" className={styles.navCta}>
              Начать общение
            </Button>
          </div>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroText}>
          <div className={styles.pill}>
            <span className={styles.pillDot} />
            Теперь с AI-помощником
          </div>
          <h1 className={styles.heroTitle}>
            Your community.
            <br />
            <span className={styles.accent}>Your conversations.</span>
          </h1>
          <p className={styles.heroLead}>
            Общайся с людьми рядом, находи единомышленников и будь в курсе всего, что происходит в твоём
            сообществе — школе, университете, доме или районе.
          </p>
          <div className={styles.heroActions}>
            <Button href="/register" size="lg" className={styles.heroPrimary}>
              Присоединиться бесплатно
            </Button>
            <Button href="/communities" variant="secondary" size="lg">
              Найти своё сообщество
            </Button>
          </div>
          <div className={styles.socialProof}>
            <div className={styles.avatars}>
              {["А", "Д", "М", "Е"].map((letter, index) => (
                <span
                  key={letter}
                  className={styles.miniAvatar}
                  style={{ backgroundColor: getAvatarColor(["Алина", "Данияр", "Мария", "Екатерина"][index]) }}
                >
                  {letter}
                </span>
              ))}
            </div>
            <span>
              <strong>25 000+</strong> активных участников
            </span>
          </div>
        </div>
        <div className={styles.heroMockup}>
          <ChatMockup />
        </div>
      </section>

      <section id="features" className={`${styles.section} ${styles.white}`}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Всё необходимое для общения</h2>
            <p className={styles.sectionLead}>Платформа, созданная для реальных сообществ</p>
          </div>
          <div className={styles.features}>
            {FEATURES.map((feature) => (
              <div key={feature.title} className={styles.feature}>
                <div className={styles.featureIcon} aria-hidden="true">
                  {feature.emoji}
                </div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureText}>{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className={styles.section}>
        <div className={`${styles.container} ${styles.narrow}`}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Как это работает</h2>
            <p className={styles.sectionLead}>Три простых шага до своего сообщества</p>
          </div>
          <div className={styles.steps}>
            {STEPS.map((step) => (
              <div key={step.number} className={styles.step}>
                <div className={styles.stepIcon} aria-hidden="true">
                  {step.emoji}
                </div>
                <div className={styles.stepNumber}>{step.number}</div>
                <h3 className={styles.featureTitle}>{step.title}</h3>
                <p className={styles.featureText}>{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="communities" className={`${styles.section} ${styles.white}`}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Примеры сообществ</h2>
            <p className={styles.sectionLead}>Тысячи сообществ уже общаются на платформе</p>
          </div>
          <div className={styles.examples}>
            {EXAMPLES.map((example) => (
              <Link key={example.name} href="/communities" className={styles.example}>
                <div className={styles.exampleEmoji} aria-hidden="true">
                  {example.emoji}
                </div>
                <div className={styles.exampleType}>{example.type}</div>
                <div className={styles.exampleName}>{example.name}</div>
                <div className={styles.exampleCount}>{example.count}</div>
              </Link>
            ))}
          </div>
          <div className={styles.center}>
            <Button href="/communities" size="lg">
              Найти своё сообщество →
            </Button>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={`${styles.container} ${styles.cta}`}>
          <div className={styles.ctaCard}>
            <h2 className={styles.ctaTitle}>Готов начать?</h2>
            <p className={styles.ctaText}>Присоединись к тысячам людей, которые уже общаются в своих сообществах</p>
            <Button href="/register" variant="white" size="lg">
              Создать аккаунт бесплатно
            </Button>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <Link href="/" className={styles.brand}>
            <LogoMark size="sm" />
            Global Chat
          </Link>
          {/* Юридические страницы появятся позже — пока это просто текст, а не ссылки */}
          <div className={styles.footerLinks}>
            <span>Политика конфиденциальности</span>
            <span>Условия использования</span>
            <span>Контакты</span>
          </div>
          <div className={styles.copyright}>© {new Date().getFullYear()} Global Chat</div>
        </div>
      </footer>
    </div>
  );
}
