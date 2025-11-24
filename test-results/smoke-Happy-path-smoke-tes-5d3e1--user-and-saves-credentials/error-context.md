# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - heading "UK Ticket Center" [level=1] [ref=e7]
    - paragraph [ref=e8]: Automated ticket management for university students
  - generic [ref=e9]:
    - generic [ref=e10]:
      - heading "Create your account" [level=3] [ref=e11]
      - paragraph [ref=e12]: Enter your invite token and credentials to get started
    - generic [ref=e13]:
      - generic [ref=e14]:
        - generic [ref=e15]:
          - generic [ref=e16]: Invite token *
          - textbox "Invite token required" [ref=e17]:
            - /placeholder: Paste your invite token
            - text: e2e-invite-token
        - generic [ref=e18]:
          - generic [ref=e19]: Email address *
          - textbox "Email address required" [ref=e20]:
            - /placeholder: you@example.com
            - text: e2e-1764014907562@example.com
        - generic [ref=e21]:
          - generic [ref=e22]: Password *
          - textbox "Password required" [ref=e23]:
            - /placeholder: Create a strong password
            - text: UserPass123!
          - paragraph [ref=e24]: Password must be at least 8 characters with a letter and number
        - generic [ref=e26] [cursor=pointer]:
          - checkbox "Enable automatic downloads Your tickets will be fetched automatically" [checked] [ref=e27]
          - generic [ref=e28]:
            - paragraph [ref=e29]: Enable automatic downloads
            - paragraph [ref=e30]: Your tickets will be fetched automatically
        - button "Create account" [active] [ref=e32]
      - generic [ref=e33]:
        - text: Already have an account?
        - link "Sign in" [ref=e34] [cursor=pointer]:
          - /url: /login
```