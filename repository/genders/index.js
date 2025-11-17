const p = require('../../lib/prisma');

// Buscar todos os gêneros ativos
const GetAllGenders = async (req, res) => {
    console.log('GetAllGenders 🚀');

    try {
        const genders = await p.allGenders.findMany({
            where: {
                situation: 1
            },
            orderBy: {
                name: 'asc'
            }
        });

        return res.status(200).json({ genders });
    } catch (error) {
        console.error("❌ Erro ao buscar gêneros:", error);
        return res.status(500).json({ message: "Erro ao buscar gêneros." });
    }
};

// Criar dados iniciais (seed)
const SeedGenders = async (req, res) => {
    console.log('SeedGenders 🚀');

    const genders = [
        "Masculino",
        "Feminino",
        "Não-binário",
        "Transgênero",
        "Gênero fluido",
        "Agênero",
        "Bigênero",
        "Demigênero",
        "Pangênero",
        "Genderqueer",
        "Andrógino",
        "Neutrois",
        "Outro",
        "Prefiro não informar"
    ];

    try {
        // Verificar se já existem gêneros cadastrados
        const existingCount = await p.allGenders.count();

        if (existingCount > 0) {
            return res.status(200).json({
                message: "Gêneros já foram cadastrados anteriormente.",
                count: existingCount
            });
        }

        // Inserir todos os gêneros
        const insertPromises = genders.map(name =>
            p.allGenders.create({
                data: { name }
            })
        );

        await Promise.all(insertPromises);

        return res.status(201).json({
            message: "Gêneros cadastrados com sucesso!",
            count: genders.length
        });
    } catch (error) {
        console.error("❌ Erro ao popular gêneros:", error);
        return res.status(500).json({ message: "Erro ao popular gêneros." });
    }
};

module.exports = { GetAllGenders, SeedGenders };
