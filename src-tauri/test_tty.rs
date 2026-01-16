fn main() {
    println!("stdin is tty: {}", atty::is(atty::Stream::Stdin));
    println!("stdout is tty: {}", atty::is(atty::Stream::Stdout));
    println!("stderr is tty: {}", atty::is(atty::Stream::Stderr));
    
    // Try to enable raw mode
    match crossterm::terminal::enable_raw_mode() {
        Ok(_) => {
            println!("Raw mode enabled successfully!");
            let _ = crossterm::terminal::disable_raw_mode();
        }
        Err(e) => {
            println!("Failed to enable raw mode: {:?}", e);
        }
    }
}
