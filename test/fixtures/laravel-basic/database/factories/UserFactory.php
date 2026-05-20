<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class UserFactory extends Factory
{
    protected $model = User::class;

    public function definition(): array
    {
        return [
            'name' => 'Ada',
            'email' => 'ada@example.com',
        ];
    }

    public function suspended(): static
    {
        return $this->state([
            'suspended_at' => now(),
        ]);
    }

    public function withPreferences(): static
    {
        return $this->state([
            'preferences' => [],
        ]);
    }

    public function configure(): static
    {
        return $this;
    }
}
