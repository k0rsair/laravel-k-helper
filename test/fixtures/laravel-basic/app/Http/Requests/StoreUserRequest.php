<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use App\Rules\Uppercase;

class StoreUserRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255', new Uppercase],
            'email' => 'required|email|unique:users,email',
            'profile.timezone' => ['nullable', 'timezone'],
        ];
    }
}
