<?php

namespace App\Livewire;

class UserTable
{
    public string $search = '';

    public bool $showArchived = false;

    public function archiveSelected()
    {
        $this->dispatch('users-archived');
    }

    public function render()
    {
        return view('livewire.user-table');
    }
}
