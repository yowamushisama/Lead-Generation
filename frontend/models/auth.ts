export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    organizationId: string;
  };
}

/** Same shape as LoginResponse — register returns a token immediately */
export type RegisterResponse = LoginResponse;
