# Video Assets — Consensus 2026 Demo

## Final Demo Reel (Concatenated)
`/workspace/agentpay-solana/demo/consensus_demo_reel.mp4` (20s, 4.9MB)

## Individual Videos
1. **Miami Drone Footage** (Veo 3.1 Lite, text-to-video)
   URL: https://cdn.muapi.ai/outputs/9f3d54aa24c14839bdff1ccfae881508.mp4
   Duration: 8s | Size: 5.1MB

2. **AgentPay Hero Animation** (Vidu Q3 Turbo, image-to-video)
   URL: https://cdn.muapi.ai/outputs/0bf67131c36b44838bb09aac61def522.mp4
   Duration: 4s | Size: 643KB

3. **Agent Studio Pipeline** (Veo 3 I2V, image-to-video)
   URL: https://cdn.muapi.ai/outputs/40a295da47984436bddb53da6f31f638.mp4
   Duration: 8s | Size: 2.4MB

## MuAPI Upload Flow
1. Upload: `POST /api/v1/upload_file` → S3 URL
2. Generate: `POST /api/v1/{model}` with image_url
3. Poll: `GET /api/v1/predictions/{id}/result`
