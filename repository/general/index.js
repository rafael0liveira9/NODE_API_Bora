const { json } = require('body-parser');
const { jwtUncrypt } = require('../../utils/midleware/auth'),
    p = require('../../lib/prisma');

const GetFaq = async (req, res) => {
    try {
        const data = await p.faq.findMany({
            where: {
                situation: 1,
            }
        })

        if (data) {
            return res.status(200).json(data);
        } else {
            return res.status(401).json(null);
        }
    } catch (error) {
        console.error("❌ Erro ao buscar FAQ:", error);
        return res.status(500).json({ message: "Erro ao buscar FAQ." });
    }
}

module.exports = { GetFaq };
