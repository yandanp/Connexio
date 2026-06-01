use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rand::Rng;
use rand::distributions::Alphanumeric;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

const TOKEN_EXPIRY_SECS: u64 = 3600; // 1 hour
const MAX_FAILED_ATTEMPTS: u32 = 5;
const LOCKOUT_DURATION_SECS: u64 = 300; // 5 minutes

#[derive(Debug, Clone)]
pub struct AuthState {
    pub pin: String,
    pub secret: String,
    pub failed_attempts: u32,
    pub lockout_until: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: u64,
    pub iat: u64,
}

impl AuthState {
    pub fn new() -> Self {
        let pin = generate_pin();
        let secret = generate_secret();
        Self {
            pin,
            secret,
            failed_attempts: 0,
            lockout_until: None,
        }
    }

    pub fn regenerate_pin(&mut self) {
        self.pin = generate_pin();
        self.failed_attempts = 0;
        self.lockout_until = None;
    }

    pub fn verify_pin(&mut self, input: &str) -> Result<String, String> {
        let now = current_timestamp();

        // Check lockout
        if let Some(lockout_until) = self.lockout_until {
            if now < lockout_until {
                let remaining = lockout_until - now;
                return Err(format!(
                    "Too many failed attempts. Try again in {} seconds.",
                    remaining
                ));
            } else {
                // Lockout expired
                self.lockout_until = None;
                self.failed_attempts = 0;
            }
        }

        if input == self.pin {
            self.failed_attempts = 0;
            let token = self.generate_token()?;
            Ok(token)
        } else {
            self.failed_attempts += 1;
            if self.failed_attempts >= MAX_FAILED_ATTEMPTS {
                self.lockout_until = Some(now + LOCKOUT_DURATION_SECS);
                Err("Too many failed attempts. Locked out for 5 minutes.".to_string())
            } else {
                let remaining = MAX_FAILED_ATTEMPTS - self.failed_attempts;
                Err(format!("Invalid PIN. {} attempts remaining.", remaining))
            }
        }
    }

    pub fn generate_token(&self) -> Result<String, String> {
        let now = current_timestamp();
        let claims = Claims {
            sub: "remote-client".to_string(),
            iat: now,
            exp: now + TOKEN_EXPIRY_SECS,
        };
        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.secret.as_bytes()),
        )
        .map_err(|e| format!("Failed to generate token: {}", e))
    }

    pub fn verify_token(&self, token: &str) -> bool {
        let validation = Validation::default();
        decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.secret.as_bytes()),
            &validation,
        )
        .is_ok()
    }
}

fn generate_pin() -> String {
    let mut rng = rand::thread_rng();
    format!("{:06}", rng.gen_range(0..1_000_000))
}

fn generate_secret() -> String {
    let mut rng = rand::thread_rng();
    (0..32)
        .map(|_| rng.sample(Alphanumeric) as char)
        .collect()
}

fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}
