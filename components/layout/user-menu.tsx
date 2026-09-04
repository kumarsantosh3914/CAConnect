'use client'

import { LogOut } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

export function UserMenu({ email, firmName }: { email: string; firmName: string | null }) {
  const initials = (firmName || email).slice(0, 2).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" className="h-9 gap-2 px-2">
            <Avatar className="size-7">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-40 truncate text-sm sm:inline">{firmName || email}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        {/*
          Base UI's GroupLabel throws "MenuGroupContext is missing" unless it
          sits inside a Group. Without this wrapper, opening the menu crashes
          the whole page — which it did, on every route, for every user.
        */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium">{firmName || 'Your firm'}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {/* A POST, not a link — signing out must not be reachable by prefetch. */}
        <form action="/auth/signout" method="post">
          <DropdownMenuItem
            nativeButton
            render={
              <button type="submit" className="w-full">
                <LogOut className="size-4" aria-hidden />
                Log out
              </button>
            }
          />
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
