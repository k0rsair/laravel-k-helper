<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class CleanupReportsCommand extends Command
{
    protected string $name = 'reports:cleanup';

    protected $description = 'Clean report artifacts';

    public function handle(): int
    {
        return self::SUCCESS;
    }
}
