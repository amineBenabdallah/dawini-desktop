import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TitlebarComponent } from './shared/components/titlebar/titlebar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TitlebarComponent],
  template: `
    <app-titlebar />
    <router-outlet />
  `,
})
export class AppComponent {}
