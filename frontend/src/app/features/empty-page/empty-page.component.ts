import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-empty-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './empty-page.component.html',
  styleUrl: './empty-page.component.scss',
})
export class EmptyPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  readonly pageTitle = signal<string>('Overview');
  readonly pageIcon = signal<string>('folder');

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      if (data['title']) {
        this.pageTitle.set(data['title']);
      }
      if (data['icon']) {
        this.pageIcon.set(data['icon']);
      }
    });
  }
}
