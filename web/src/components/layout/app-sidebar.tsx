"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { NavGroup } from "@/components/layout/nav-group"
import { sidebarData } from "./data/sidebar-data"
import { Logo } from "@/components/logo"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <div className="relative">
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader>
          <Logo />
        </SidebarHeader>
        <SidebarContent>
          {sidebarData.navGroups.map((props) => (
            <NavGroup key={props.title} {...props} />
          ))}
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
    </div>
  )
}
