<?php

namespace App\View\Components;

use Illuminate\View\Component;

class UserCard extends Component
{
    public function __construct(
        public string $title,
        public bool $highlighted = false,
    ) {
    }

    public function render()
    {
        return view('components.user-card');
    }
}
