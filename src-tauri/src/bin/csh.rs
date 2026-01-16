//! CSH - Connexio Shell
//!
//! Standalone binary for the Connexio Shell.
//! This can be run directly or spawned by the Connexio terminal.

fn main() {
    let exit_code = connexio_lib::csh::shell::main();
    std::process::exit(exit_code);
}
