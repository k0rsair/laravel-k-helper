<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class SendReportsCommand extends Command
{
    protected $signature = 'reports:send {user?} {--force}';

    protected $description = 'Send reports';

    public function handle(): int
    {
        return self::SUCCESS;
    }
}
