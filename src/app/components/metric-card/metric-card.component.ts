import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface MetricData {
  title: string;
  value: string | number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  icon: string;
  color: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  subtitle?: string;
}

@Component({
  selector: 'app-metric-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './metric-card.component.html',
  styleUrls: ['./metric-card.component.scss']
})
export class MetricCardComponent {
  @Input() metric!: MetricData;

  get changeIcon(): string {
    switch (this.metric.changeType) {
      case 'increase': return '↗';
      case 'decrease': return '↘';
      default: return '→';
    }
  }

  get changeClass(): string {
    return `change-${this.metric.changeType}`;
  }

  get cardColorClass(): string {
    return `card-${this.metric.color}`;
  }
}