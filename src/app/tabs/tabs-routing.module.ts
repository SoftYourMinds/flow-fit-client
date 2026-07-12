import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'clients',
        loadComponent: () => import('../pages/clients/clients.component').then(m => m.ClientsComponent)
      },
      {
        path: 'clients/:id',
        loadComponent: () => import('../pages/clients/details/details.component').then(m => m.DetailsComponent)
      },
      {
        path: 'locations',
        loadComponent: () => import('../pages/locations/locations.component').then(m => m.LocationsComponent)
      },
      {
        path: 'tab2',
        loadChildren: () => import('../tab2/tab2.module').then(m => m.Tab2PageModule)
      },
      {
        path: '',
        redirectTo: '/tabs/clients',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    redirectTo: '/tabs/clients',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class TabsPageRoutingModule {}
