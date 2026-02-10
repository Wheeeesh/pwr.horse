import { h } from 'preact';

interface CardProps {
  title: string;
  description: string;
  badge?: string;
  onClick?: () => void;
}

const Card = ({ title, description, badge, onClick }: CardProps) => (
  <div class="card" onClick={onClick}>
    <div class="inline" style={{ justifyContent: 'space-between' }}>
      <h3>{title}</h3>
      {badge && <span class="badge">{badge}</span>}
    </div>
    <p>{description}</p>
  </div>
);

export default Card;
